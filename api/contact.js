function plainTextResponse(message, status) {
  return new Response(message, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
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
    body = await req.json()
  } catch {
    return plainTextResponse('Invalid request.', 400)
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''

  if (!name || !/^\S+@\S+\.\S+$/.test(email) || !message) {
    return plainTextResponse('Please include your name, a valid email and a message.', 400)
  }

  const apiKey = process.env.RESEND_API_KEY
  const to = process.env.CONTACT_TO_EMAIL
  const from = process.env.RESEND_FROM_EMAIL || 'Creosite <onboarding@resend.dev>'

  if (!apiKey || !to) {
    return plainTextResponse('Contact email is not configured yet.', 500)
  }

  const subject = `New contact form message from ${name}`
  const escapedPhone = phone ? escapeHtml(phone) : 'Not provided'
  const html = `
    <h2>New contact form submission</h2>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>Phone:</strong> ${escapedPhone}</p>
    <p><strong>Message:</strong></p>
    <p>${escapeHtml(message).replaceAll('\n', '<br />')}</p>
  `

  const text = [
    'New contact form submission',
    `Name: ${name}`,
    `Email: ${email}`,
    `Phone: ${phone || 'Not provided'}`,
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
      reply_to: email,
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
