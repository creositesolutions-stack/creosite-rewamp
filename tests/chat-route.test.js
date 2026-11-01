import test from 'node:test'
import assert from 'node:assert/strict'
import chatHandler from '../api/chat.js'

const validMessages = [{ id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Hello Creo, can you help me?' }] }]

test('chat route rejects invalid message lists and initializes the visitor cookie', async () => {
  const response = await chatHandler(new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [] }),
  }))

  assert.equal(response.status, 400)
  assert.equal(await response.text(), 'Invalid request.')
  assert.match(response.headers.get('set-cookie') || '', /^creo_visitor=/)
})

test('chat route does not fall back to untrusted browser history when storage is unavailable', async () => {
  const previousUrl = process.env.SUPABASE_URL
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  try {
    const response = await chatHandler(new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ conversationId: '5a687bc9-7103-4bcb-9b1a-3d73e35d8af0', messages: validMessages }),
    }))
    assert.equal(response.status, 503)
    assert.match(await response.text(), /storage is temporarily unavailable/i)
  } finally {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL
    else process.env.SUPABASE_URL = previousUrl
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey
  }
})

test('chat route rejects unsupported methods', async () => {
  const response = await chatHandler(new Request('http://localhost/api/chat', { method: 'GET' }))
  assert.equal(response.status, 405)
})
