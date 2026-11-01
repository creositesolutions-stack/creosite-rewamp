import { createRateLimiter } from '../shared/guardrails.js'
import { getClientIp } from '../server/request.js'
import { verifyTurnstile } from '../server/turnstile.js'

export const config = { runtime: 'edge' }

const limiter = createRateLimiter({ max: 8, windowMs: 60 * 60 * 1000 })
const MAX_NAME = 120
const MAX_EMAIL = 254
const MAX_PHONE = 40
const MAX_MESSAGE = 5_000
const MAX_BODY_BYTES = 32_000

async function readLimitedJson(request) {
  if (Number(request.headers.get('content-length') || 0) > MAX_BODY_BYTES) {
    throw new Error('payload_too_large')
  }

  let text = ''
  if (request.body && typeof request.body.getReader === 'function') {
    const reader = request.body.getReader()
    const decoder = new TextDecoder()
    let total = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => {})
        throw new Error('payload_too_large')
      }
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
  } else {
    text = await request.text()
    if (text.length > MAX_BODY_BYTES) throw new Error('payload_too_large')
  }

  return JSON.parse(text)
}

function plainTextResponse(message, status) {
  return new Response(message, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

function cleanSingleLine(value, maxLength) {
  return String(value)
    .replace(/[\r\n\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return plainTextResponse('Method Not Allowed', 405)
  }

  let body
  try {
    body = await readLimitedJson(req)
  } catch (error) {
    if (error instanceof Error && error.message === 'payload_too_large') {
      return plainTextResponse('Request body is too large.', 413)
    }
    return plainTextResponse('Invalid request.', 400)
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''

  if (!name || !/^\S+@\S+\.\S+$/.test(email) || !message) {
    return plainTextResponse('Please include your name, a valid email and a message.', 400)
  }

  if (name.length > MAX_NAME || email.length > MAX_EMAIL || phone.length > MAX_PHONE || message.length > MAX_MESSAGE) {
    return plainTextResponse('Your message is too long. Please shorten it and try again.', 400)
  }

  const ip = getClientIp(req)
  const turnstile = await verifyTurnstile(body.turnstileToken, ip)
  if (!turnstile.ok) {
    return plainTextResponse('Please complete the verification and try again.', 403)
  }

  const rate = limiter.check(ip)
  if (rate.limited) {
    return new Response('Too many messages. Please try again later.', {
      status: 429,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': String(rate.retryAfter) },
    })
  }

  const apiKey = process.env.RESEND_API_KEY
  const to = process.env.CONTACT_TO_EMAIL
  const from = process.env.RESEND_FROM_EMAIL || 'Creosite <onboarding@resend.dev>'

  if (!apiKey || !to) {
    return plainTextResponse('Contact email is not configured yet.', 500)
  }

  const safeName = cleanSingleLine(name, MAX_NAME)
  const safeEmail = cleanSingleLine(email, MAX_EMAIL)
  const safePhone = cleanSingleLine(phone, MAX_PHONE)
  const subject = `New contact form message from ${safeName}`
  const escapedPhone = safePhone ? escapeHtml(safePhone) : 'Not provided'
  const html = `
    <h2>New contact form submission</h2>
    <p><strong>Name:</strong> ${escapeHtml(safeName)}</p>
    <p><strong>Email:</strong> ${escapeHtml(safeEmail)}</p>
    <p><strong>Phone:</strong> ${escapedPhone}</p>
    <p><strong>Message:</strong></p>
    <p>${escapeHtml(message).replaceAll('\n', '<br />')}</p>
  `

  const text = [
    'New contact form submission',
    `Name: ${safeName}`,
    `Email: ${safeEmail}`,
    `Phone: ${safePhone || 'Not provided'}`,
    '',
    message,
  ].join('\n')

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: safeEmail,
      subject,
      html,
      text,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    console.error('Resend email failed', response.status, errorText)
    return plainTextResponse('We could not send your message right now.', 502)
  }

  return plainTextResponse('OK', 200)
}
