import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getVisitorIdentity,
  parseCookies,
  parseVisitorCookie,
  serializeVisitorCookie,
} from '../server/visitor.js'

test('visitor cookie signs and validates UUID identity', () => {
  process.env.VISITOR_COOKIE_SECRET = 'test-secret-for-visitor-cookie'
  const id = '123e4567-e89b-42d3-a456-426614174000'
  const cookie = serializeVisitorCookie(id)
  const value = cookie.split(';', 1)[0].split('=').slice(1).join('=')

  assert.equal(parseVisitorCookie(value), id)
  assert.equal(parseVisitorCookie(`${value.slice(0, -1)}x`), null)
  assert.match(cookie, /HttpOnly/)
  assert.match(cookie, /SameSite=Lax/)
})

test('visitor identity rotates invalid cookies and parses cookie headers', () => {
  process.env.VISITOR_COOKIE_SECRET = 'test-secret-for-visitor-cookie'
  const cookies = parseCookies('other=one; creo_visitor=invalid')
  assert.equal(cookies.other, 'one')
  const identity = getVisitorIdentity(new Request('https://example.test/', {
    headers: { cookie: 'creo_visitor=invalid' },
  }))

  assert.match(identity.visitorId, /^[0-9a-f-]{36}$/i)
  assert.match(identity.setCookie, /^creo_visitor=/)
})
