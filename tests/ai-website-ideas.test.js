import test from 'node:test'
import assert from 'node:assert/strict'
import ideasHandler, { IDEAS_SYSTEM_PROMPT, ILLEGAL_BUSINESS_MESSAGE, INVALID_BUSINESS_MESSAGE, normalizeIdeaText } from '../api/ideas.js'
import { buildIdeaDiscussionPrompt, DEMO_EXAMPLES, getIdeas } from '../src/ai-website-ideas.js'

async function post(body) {
  return ideasHandler(new Request('http://localhost/api/ideas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }))
}

test('idea prompt requires one chatbot and two practical small-business integrations', () => {
  assert.match(IDEAS_SYSTEM_PROMPT, /customer-facing website chatbot/)
  assert.match(IDEAS_SYSTEM_PROMPT, /Ideas 2 and 3 MUST be distinct/)
  assert.match(IDEAS_SYSTEM_PROMPT, /untrusted data/)
  assert.match(IDEAS_SYSTEM_PROMPT, /illegal_business/)
  assert.match(IDEAS_SYSTEM_PROMPT, /invalid_business/)
  assert.match(INVALID_BUSINESS_MESSAGE, /valid business type/)
  assert.match(ILLEGAL_BUSINESS_MESSAGE, /lawful businesses/)
})

test('offering demo includes travel, dental, and product cards with Ask AI descriptions', () => {
  const demo = DEMO_EXAMPLES.find(({ title }) => title === 'Explain your offering')
  const offeringStep = demo.steps.find(({ type }) => type === 'offerings')
  assert.deepEqual(offeringStep.items.map(({ category }) => category), ['TOUR PACKAGE', 'DENTAL TREATMENT', 'TECH PRODUCT'])
  assert.ok(offeringStep.items.every(({ description }) => description.endsWith('.')))
})

test('model idea text is trimmed to display limits and empty fields use a safe fallback', () => {
  assert.equal(normalizeIdeaText('  Useful   idea for a small business  ', 24, 'fallback'), 'Useful idea for a small')
  assert.equal(normalizeIdeaText('', 24, 'fallback idea'), 'fallback idea')
})

test('ideas endpoint rejects empty and overlong business types before calling a model', async () => {
  const empty = await post({ businessType: '  ' })
  assert.equal(empty.status, 400)

  const long = await post({ businessType: 'one two three four five six seven' })
  assert.equal(long.status, 400)
  assert.match((await long.json()).message, /Creo/)
})

test('ideas endpoint accepts only POST', async () => {
  const response = await ideasHandler(new Request('http://localhost/api/ideas'))
  assert.equal(response.status, 405)
})

test('discussion prompt includes the complete idea description within Creo chat limits', () => {
  const description = 'Answer common customer questions about products, opening hours, delivery areas, allergy information, and current promotions without waiting for staff.'
  const prompt = buildIdeaDiscussionPrompt({ title: 'Customer support chatbot', description }, 'independent neighborhood bakery')
  assert.match(prompt, /Customer support chatbot/)
  assert.match(prompt, /independent neighborhood bakery/)
  assert.ok(prompt.includes(description))
  assert.ok(prompt.trim().split(/\s+/).length <= 120)
})

test('client reports a useful error when the ideas endpoint returns an empty body', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(null, { status: 503 })
  try {
    await assert.rejects(getIdeas('bakery'), /ideas service returned an error \(503\)/)
  } finally {
    globalThis.fetch = originalFetch
  }
})
