import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_IDEAS, getIdeas } from '../src/ai-website-ideas.js'

test('business idea lookup returns the expected category or default ideas', async () => {
  assert.match((await getIdeas('bakery'))[0], /menu, allergy and opening-hour/)
  assert.match((await getIdeas('Plumber'))[0], /job details for quotes/)
  assert.match((await getIdeas('yoga studio'))[0], /class time and membership/)
  assert.match((await getIdeas('dentist'))[0], /appointment requests and reminders/)
  assert.deepEqual(await getIdeas('xyz'), DEFAULT_IDEAS)
  assert.deepEqual(await getIdeas('   '), DEFAULT_IDEAS)
})
