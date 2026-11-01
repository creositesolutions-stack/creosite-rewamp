import test from 'node:test'
import assert from 'node:assert/strict'
import ephemeralChatHandler from '../api/ephemeral-chat.js'

test('ephemeral chat accepts only POST', async () => {
  const response = await ephemeralChatHandler(new Request('http://localhost/api/ephemeral-chat'))
  assert.equal(response.status, 405)
})

test('ephemeral chat rejects empty message lists without calling the model', async () => {
  const response = await ephemeralChatHandler(new Request('http://localhost/api/ephemeral-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [] }),
  }))
  assert.equal(response.status, 400)
  assert.equal((await response.json()).error, 'invalid_request')
})
