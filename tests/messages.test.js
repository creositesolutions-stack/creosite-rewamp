import test from 'node:test'
import assert from 'node:assert/strict'
import {
  deriveConversationTitle,
  getMessageText,
  messageToRecord,
  normalizeUserMessage,
} from '../server/messages.js'

test('message helpers normalize text and preserve UI ids and parts', () => {
  const input = { id: 'ui-user-1', role: 'user', parts: [{ type: 'text', text: '  Build a website  ' }] }
  const normalized = normalizeUserMessage(input)
  const record = messageToRecord({ id: 'ui-assistant-1', role: 'assistant', parts: [{ type: 'text', text: 'A helpful reply.' }] })

  assert.equal(getMessageText(input), 'Build a website')
  assert.equal(normalized.id, 'ui-user-1')
  assert.equal(record.uiId, 'ui-assistant-1')
  assert.equal(record.role, 'assistant')
  assert.equal(record.content, 'A helpful reply.')
})

test('conversation titles are compact and bounded', () => {
  assert.equal(deriveConversationTitle('Build me a website'), 'Build me a website')
  assert.equal(deriveConversationTitle('word '.repeat(30)).length, 60)
})
