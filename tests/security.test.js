import test from 'node:test'
import assert from 'node:assert/strict'
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

test('chat history validation rejects oversized conversations', () => {
  const messages = Array.from({ length: 41 }, (_, index) => ({
    id: `m-${index}`,
    role: index % 2 === 0 ? 'user' : 'assistant',
    parts: [{ type: 'text', text: `Message ${index}` }],
  }))

  assert.match(validateChatHistory(messages), /too long/i)
})
