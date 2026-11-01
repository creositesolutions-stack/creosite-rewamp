const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const VERIFY_TIMEOUT_MS = 5_000
const MAX_TOKEN_LENGTH = 2_048

export function isTurnstileConfigured() {
  return Boolean(process.env.TURNSTILE_SECRET_KEY)
}

export async function verifyTurnstile(token, remoteIp) {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return { ok: true, skipped: true }

  if (typeof token !== 'string' || !token.trim()) {
    return { ok: false, error: 'missing_token' }
  }

  const body = new URLSearchParams({
    secret,
    response: token.trim().slice(0, MAX_TOKEN_LENGTH),
  })
  if (remoteIp) body.set('remoteip', remoteIp)

  let response
  try {
    response = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    })
  } catch (error) {
    console.error('[turnstile] Verification request failed:', error instanceof Error ? error.message : 'unknown error')
    return { ok: false, error: 'verify_unavailable' }
  }

  if (!response.ok) {
    console.error('[turnstile] Verification returned HTTP', response.status)
    return { ok: false, error: 'verify_http_error' }
  }

  let result
  try {
    result = await response.json()
  } catch {
    return { ok: false, error: 'invalid_verify_response' }
  }

  if (result?.success === true) return { ok: true }

  const codes = Array.isArray(result?.['error-codes']) ? result['error-codes'].join(',') : 'verification_failed'
  return { ok: false, error: codes }
}
