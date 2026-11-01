import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'

export const VISITOR_COOKIE = 'creo_visitor'
const COOKIE_VERSION = 'v1'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365
const DEVELOPMENT_COOKIE_SECRET = randomBytes(32).toString('hex')

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

export function hasVisitorCookieSecret() {
  return Boolean(process.env.VISITOR_COOKIE_SECRET) || !isProduction()
}

function getCookieSecret() {
  const configured = process.env.VISITOR_COOKIE_SECRET
  if (configured) return configured
  if (isProduction()) throw new Error('VISITOR_COOKIE_SECRET is required in production.')
  return DEVELOPMENT_COOKIE_SECRET
}

function sign(value) {
  return createHmac('sha256', getCookieSecret()).update(value).digest('base64url')
}

function signaturesMatch(a, b) {
  const left = Buffer.from(String(a))
  const right = Buffer.from(String(b))
  return left.length === right.length && timingSafeEqual(left, right)
}

export function parseCookies(cookieHeader) {
  const cookies = {}
  if (!cookieHeader) return cookies

  for (const part of String(cookieHeader).split(';')) {
    const separator = part.indexOf('=')
    if (separator < 0) continue
    const name = part.slice(0, separator).trim()
    const value = part.slice(separator + 1).trim()
    if (!name) continue
    try {
      cookies[name] = decodeURIComponent(value)
    } catch {
      cookies[name] = value
    }
  }

  return cookies
}

export function parseVisitorCookie(rawValue) {
  if (!rawValue) return null

  const parts = String(rawValue).split('.')
  if (parts.length !== 3 || parts[0] !== COOKIE_VERSION) return null

  const [, id, signature] = parts
  if (!isUuid(id)) return null

  const expected = sign(`${COOKIE_VERSION}.${id}`)
  return signaturesMatch(signature, expected) ? id : null
}

export function isProduction() {
  return process.env.NODE_ENV === 'production' ||
    process.env.APP_ENV === 'production' ||
    ['production', 'preview'].includes(process.env.VERCEL_ENV)
}

export function serializeVisitorCookie(visitorId) {
  const payload = `${COOKIE_VERSION}.${visitorId}`
  const value = `${payload}.${sign(payload)}`
  const attributes = [
    `${VISITOR_COOKIE}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
  ]
  if (isProduction()) attributes.push('Secure')
  return attributes.join('; ')
}

export function getVisitorIdentity(request) {
  const cookies = parseCookies(request.headers.get('cookie'))
  const existing = parseVisitorCookie(cookies[VISITOR_COOKIE])
  if (existing) return { visitorId: existing, setCookie: null }

  const visitorId = randomUUID()
  return { visitorId, setCookie: serializeVisitorCookie(visitorId) }
}
