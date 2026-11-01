function firstValue(value) {
  return typeof value === 'string' ? value.split(',')[0].trim() : ''
}

function lastValue(value) {
  if (typeof value !== 'string') return ''
  const parts = value.split(',')
  return parts[parts.length - 1].trim()
}

export function getClientIp(request) {
  const headers = request?.headers
  if (!headers || typeof headers.get !== 'function') return 'unknown'

  const trusted = firstValue(headers.get('x-vercel-forwarded-for')) ||
    firstValue(headers.get('x-real-ip')) ||
    firstValue(headers.get('cf-connecting-ip'))
  if (trusted) return trusted.slice(0, 64)

  const forwarded = lastValue(headers.get('x-forwarded-for'))
  return (forwarded || 'unknown').slice(0, 64)
}
