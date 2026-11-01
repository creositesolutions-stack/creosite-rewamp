import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getLangSmithPrivacyConfig,
  redactPII,
  sanitizeChildInputs,
  sanitizeRootInputs,
  stripSecrets,
} from '../server/privacy.js'

test('secret stripping removes common API keys and bearer tokens', () => {
  const value = 'key sk-abcdefghijklmnopqrstuvwxyz and Bearer abcdefghijklmnopqrstuvwxyz'
  const sanitized = stripSecrets(value)
  assert.doesNotMatch(sanitized, /sk-abcdefghijklmnopqrstuvwxyz/)
  assert.doesNotMatch(sanitized, /Bearer abcdefghijklmnopqrstuvwxyz/)
})

test('redacted mode removes email and phone values from text', () => {
  const sanitized = redactPII('Contact me at varun@example.com or +1 (415) 555-0198.')
  assert.match(sanitized, /\[redacted-email\]/)
  assert.match(sanitized, /\[redacted-phone\]/)
  assert.doesNotMatch(sanitized, /varun@example.com/)
})

test('LangSmith root and child processors omit provider credentials and redact messages', () => {
  const root = sanitizeRootInputs({
    model: { modelId: 'gpt-4o-mini' },
    messages: [{ id: 'a7d0caa3-0a8d-465c-8c54-61dbeb20c004', role: 'user', parts: [{ type: 'text', text: 'Email me at person@example.com' }] }],
    providerOptions: { apiKey: 'sk-abcdefghijklmnopqrstuvwxyz' },
  }, 'REDACTED')
  const child = sanitizeChildInputs({
    prompt: [{ role: 'user', content: 'Call +1 415 555 0198' }],
    providerOptions: { apiKey: 'secret-value' },
  }, 'REDACTED')

  assert.equal(root.model, 'gpt-4o-mini')
  assert.equal(root.providerOptions, undefined)
  assert.doesNotMatch(JSON.stringify(root), /a7d0caa3-0a8d-465c-8c54-61dbeb20c004/)
  assert.match(JSON.stringify(root), /\[redacted-email\]/)
  assert.equal(child.providerOptions, undefined)
  assert.match(JSON.stringify(child), /\[redacted-phone\]/)
  assert.equal(getLangSmithPrivacyConfig('DISABLED').enabled, false)
})
