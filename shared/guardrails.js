export const MAX_WORDS = 20
export const RATE_LIMIT_MAX = 10
export const RATE_LIMIT_WINDOW_MS = 60_000

export const GUARDRAIL_MESSAGES = {
  empty: 'Please type a message first.',
  tooLong: `Please shorten your message to ${MAX_WORDS} words or fewer.`,
  tooMany: `You’ve reached the limit of ${RATE_LIMIT_MAX} messages per minute. Please wait a moment and try again.`,
  notPlain: 'Please send plain English text only. Images, files, emojis and encoded text aren’t supported.',
}

const typographicReplacements = {
  '’': "'",
  '‘': "'",
  '“': '"',
  '”': '"',
  '–': '-',
  '—': '-',
  '…': '...',
  '\u00a0': ' ',
}

export function normalizeText(text) {
  return text.replace(/[’‘“”–—…\u00a0]/g, (char) => typographicReplacements[char])
}

export function countWords(text) {
  return (text.trim().match(/\S+/g) || []).length
}

export function isPlainEnglish(text) {
  if (!text.trim()) return false
  const normalized = normalizeText(text)
  if (!/^[\x09\x0A\x0D\x20-\x7E]+$/.test(normalized)) return false
  if (/data:[^\s;]+;base64,/i.test(normalized)) return false
  if (/[A-Za-z0-9+/]{40,}={0,2}/.test(normalized)) return false
  if (/\b[0-9a-fA-F]{32,}\b/.test(normalized)) return false
  return true
}

export function validateChatText(text) {
  if (!text || !text.trim()) return GUARDRAIL_MESSAGES.empty
  if (countWords(text) > MAX_WORDS) return GUARDRAIL_MESSAGES.tooLong
  if (!isPlainEnglish(text)) return GUARDRAIL_MESSAGES.notPlain
  return ''
}

export function hasUnsupportedParts(messages) {
  return messages.some((message) => {
    if (Array.isArray(message.experimental_attachments) && message.experimental_attachments.length > 0) return true
    if (!Array.isArray(message.parts)) return false
    return message.parts.some((part) => {
      if (part?.type === 'file' || part?.type === 'image') return true
      return typeof part?.text === 'string' && /data:[^\s;]+;base64,/i.test(part.text)
    })
  })
}

export function getLastUserText(messages) {
  const lastUser = [...messages].reverse().find((message) => message?.role === 'user')
  if (!lastUser) return ''
  if (Array.isArray(lastUser.parts)) {
    return lastUser.parts.filter((part) => part?.type === 'text' && typeof part.text === 'string').map((part) => part.text).join(' ').trim()
  }
  return typeof lastUser.content === 'string' ? lastUser.content.trim() : ''
}

export function createRateLimiter({ max = RATE_LIMIT_MAX, windowMs = RATE_LIMIT_WINDOW_MS, maxSessions = 5000 } = {}) {
  const sessions = new Map()

  const prune = (now) => {
    if (sessions.size <= maxSessions) return
    for (const [key, timestamps] of sessions) {
      if (timestamps.every((time) => now - time >= windowMs)) sessions.delete(key)
    }
  }

  return {
    check(sessionKey, now = Date.now()) {
      const timestamps = (sessions.get(sessionKey) || []).filter((time) => now - time < windowMs)
      if (timestamps.length >= max) {
        const retryAfter = Math.max(1, Math.ceil((windowMs - (now - timestamps[0])) / 1000))
        return { limited: true, retryAfter, remaining: 0 }
      }
      timestamps.push(now)
      sessions.set(sessionKey, timestamps)
      prune(now)
      return { limited: false, retryAfter: 0, remaining: max - timestamps.length }
    },
  }
}
