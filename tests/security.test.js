import test from 'node:test'
import assert from 'node:assert/strict'
import contactHandler from '../api/contact.js'
import ideasHandler from '../api/ideas.js'
import { getClientIp } from '../server/request.js'
import { validateChatHistory } from '../shared/guardrails.js'

test('client IP ignores spoofed forwarded chains and prefers trusted platform headers', () => {
  const request = new Request('http://localhost/api/contact', {
    headers: {
      'x-forwarded-for': '1.2.3.4, 203.0.113.9',
      'x-real-ip': '203.0.113.7',
      'x-vercel-forwarded-for': '203.0.113.8',
    },
  })

  assert.equal(getClientIp(request), '203.0.113.8')
})

test('contact endpoint requires a Turnstile token when the secret is configured', async () => {
  const previous = process.env.TURNSTILE_SECRET_KEY
  process.env.TURNSTILE_SECRET_KEY = 'test-secret'
  try {
    const response = await contactHandler(new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-real-ip': '203.0.113.10' },
      body: JSON.stringify({ name: 'Test', email: 'test@example.com', message: 'Hello there.' }),
    }))
    assert.equal(response.status, 403)
    assert.match(await response.text(), /verification/i)
  } finally {
    if (previous === undefined) delete process.env.TURNSTILE_SECRET_KEY
    else process.env.TURNSTILE_SECRET_KEY = previous
  }
})

test('ideas endpoint requires a Turnstile token when the secret is configured', async () => {
  const previous = process.env.TURNSTILE_SECRET_KEY
  process.env.TURNSTILE_SECRET_KEY = 'test-secret'
  try {
    const response = await ideasHandler(new Request('http://localhost/api/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-real-ip': '203.0.113.11' },
      body: JSON.stringify({ businessType: 'bakery' }),
    }))
    assert.equal(response.status, 403)
    assert.equal((await response.json()).error, 'turnstile_failed')
  } finally {
    if (previous === undefined) delete process.env.TURNSTILE_SECRET_KEY
    else process.env.TURNSTILE_SECRET_KEY = previous
  }
})

test('chat history validation rejects oversized conversations', () => {
  const messages = Array.from({ length: 41 }, (_, index) => ({
    id: `m-${index}`,
    role: index % 2 === 0 ? 'user' : 'assistant',
    parts: [{ type: 'text', text: `Message ${index}` }],
  }))

  assert.match(validateChatHistory(messages), /too long/i)
})
