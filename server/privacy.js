import { createHash } from 'node:crypto'

export const TRACING_PRIVACY_MODES = ['FULL', 'REDACTED', 'METADATA_ONLY', 'DISABLED']

const SENSITIVE_KEY_PATTERN = /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api[_-]?key|apikey|access[_-]?token|refresh[_-]?token|id[_-]?token|token|secret|client[_-]?secret|password|passwd|openai[_-]?api[_-]?key|langsmith[_-]?api[_-]?key|supabase[_-]?service[_-]?role[_-]?key)$/i

const SECRET_PATTERNS = [
  [/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [redacted-token]'],
  [/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[redacted-api-key]'],
  [/\bls(?:v2)?[_-][A-Za-z0-9_-]{12,}\b/g, '[redacted-api-key]'],
  [/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted-jwt]'],
  [/\bAKIA[0-9A-Z]{16}\b/g, '[redacted-access-key]'],
  [/\b(?:api[_-]?key|token|secret|password)\s*[:=]\s*[^\s,;]+/gi, '[redacted-secret]'],
]

export function getTracingPrivacyMode() {
  const configured = String(
    process.env.LANGSMITH_TRACING_PRIVACY ||
      process.env.CREO_TRACING_PRIVACY ||
      'REDACTED',
  ).toUpperCase()

  return TRACING_PRIVACY_MODES.includes(configured) ? configured : 'REDACTED'
}

export function stripSecrets(text) {
  if (typeof text !== 'string' || !text) return text
  return SECRET_PATTERNS.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), text)
}

export function redactPII(text) {
  if (typeof text !== 'string' || !text) return text

  const withoutEmails = text.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted-email]')

  return withoutEmails.replace(/(\+?\d[\d\s().-]{7,}\d)/g, (match) => {
    const digits = match.replace(/\D/g, '')
    return digits.length >= 8 ? '[redacted-phone]' : match
  })
}

export function redactText(text) {
  return redactPII(stripSecrets(text))
}

function sanitizeString(value, mode) {
  const withoutSecrets = stripSecrets(value)
  return mode === 'REDACTED' || mode === 'METADATA_ONLY' ? redactPII(withoutSecrets) : withoutSecrets
}

export function sanitizeValue(value, { mode = 'REDACTED', depth = 0, seen = new WeakSet() } = {}) {
  if (value == null) return value
  if (typeof value === 'string') return sanitizeString(value.slice(0, 8000), mode)
  if (typeof value === 'number' || typeof value === 'boolean') return value

  if (typeof value === 'bigint') return String(value)
  if (typeof value === 'function') return '[function]'
  if (typeof value !== 'object') return String(value)

  if (depth >= 8) return '[max-depth]'
  if (seen.has(value)) return '[circular]'
  seen.add(value)

  if (value instanceof Error) {
    return { name: value.name, message: sanitizeString(value.message, mode) }
  }

  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => sanitizeValue(item, { mode, depth: depth + 1, seen }))
  }

  const result = {}
  for (const [key, entry] of Object.entries(value).slice(0, 100)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      result[key] = '[redacted]'
    } else {
      result[key] = sanitizeValue(entry, { mode, depth: depth + 1, seen })
    }
  }
  return result
}

function getModelId(model) {
  if (typeof model === 'string') return model
  if (model && typeof model.modelId === 'string') return model.modelId
  const provider = model?.config?.provider
  return typeof provider === 'string' ? provider : 'unknown'
}

function sanitizeMessage(message, mode) {
  if (!message || typeof message !== 'object') return sanitizeValue(message, { mode })

  const picked = {}
  if (typeof message.role === 'string') picked.role = message.role
  if (message.content != null) picked.content = sanitizeValue(message.content, { mode })
  if (Array.isArray(message.parts)) picked.parts = sanitizeValue(message.parts, { mode })
  if (Array.isArray(message.toolCalls)) picked.toolCalls = sanitizeValue(message.toolCalls, { mode })
  return picked
}

export function sanitizeRootInputs(inputs, mode = getTracingPrivacyMode()) {
  const value = inputs ?? {}
  const messages = Array.isArray(value.messages) ? value.messages : undefined
  const prompt = typeof value.prompt === 'string' ? value.prompt : undefined

  const safe = {
    model: getModelId(value.model),
    messageCount: messages?.length ?? (prompt ? 1 : 0),
  }

  if (value.temperature != null) safe.temperature = value.temperature
  if (value.maxOutputTokens != null) safe.maxOutputTokens = value.maxOutputTokens
  if (value.topP != null) safe.topP = value.topP
  if (value.tools && typeof value.tools === 'object') safe.toolCount = Object.keys(value.tools).length

  if (mode === 'METADATA_ONLY') return safe

  if (prompt) safe.prompt = sanitizeString(prompt, mode)
  if (value.system) safe.system = sanitizeString(String(value.system), mode)
  if (messages) safe.messages = messages.map((message) => sanitizeMessage(message, mode))

  return safe
}

function extractContent(raw) {
  if (raw == null) return undefined
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'object' && 'content' in raw) return raw.content
  return undefined
}

export async function sanitizeRootOutputs(outputs, mode = getTracingPrivacyMode()) {
  const raw = outputs?.outputs ?? outputs
  let content
  try {
    content = extractContent(raw)
    if (content && typeof content.then === 'function') content = await content
    if (content == null && raw && typeof raw.text !== 'undefined') {
      content = raw.text
      if (content && typeof content.then === 'function') content = await content
    }
  } catch {
    content = undefined
  }

  if (mode === 'METADATA_ONLY') {
    return {
      role: 'assistant',
      content: '[redacted]',
      contentLength: typeof content === 'string' ? content.length : undefined,
    }
  }

  if (typeof content === 'string') {
    return { role: 'assistant', content: sanitizeString(content, mode) }
  }

  if (Array.isArray(content)) {
    return { role: 'assistant', content: sanitizeValue(content, { mode }) }
  }

  return { role: 'assistant', content: sanitizeValue(content ?? raw, { mode }) }
}

export function sanitizeChildInputs(inputs, mode = getTracingPrivacyMode()) {
  const value = inputs ?? {}
  const prompt = Array.isArray(value.prompt) ? value.prompt : undefined

  const safe = {
    messageCount: prompt?.length ?? 0,
  }

  if (value.temperature != null) safe.temperature = value.temperature
  if (value.maxOutputTokens != null) safe.maxOutputTokens = value.maxOutputTokens
  if (value.topP != null) safe.topP = value.topP
  if (value.toolChoice != null) safe.toolChoice = sanitizeValue(value.toolChoice, { mode })
  if (value.tools && typeof value.tools === 'object') safe.toolCount = Object.keys(value.tools).length

  if (mode !== 'METADATA_ONLY' && prompt) {
    safe.messages = prompt.map((message) => sanitizeMessage(message, mode))
  }

  return safe
}

export function sanitizeChildOutputs(outputs, mode = getTracingPrivacyMode()) {
  const raw = outputs?.outputs ?? outputs
  const content = raw?.content
  const finishReason = raw?.finishReason
  const usage = raw?.usage ?? raw?.usage_metadata

  const safe = { role: 'assistant' }

  if (mode === 'METADATA_ONLY') {
    safe.content = '[redacted]'
    if (typeof content === 'string') safe.contentLength = content.length
  } else if (typeof content === 'string') {
    safe.content = sanitizeString(content, mode)
  } else if (content != null) {
    safe.content = sanitizeValue(content, { mode })
  } else {
    safe.content = '[redacted]'
  }

  if (finishReason != null) safe.finishReason = sanitizeValue(finishReason, { mode })
  if (usage != null) safe.usage = sanitizeValue(usage, { mode })

  return safe
}

export function getLangSmithPrivacyConfig(mode = getTracingPrivacyMode()) {
  if (mode === 'DISABLED') {
    return { mode, enabled: false }
  }

  return {
    mode,
    enabled: true,
    processInputs: (inputs) => sanitizeRootInputs(inputs, mode),
    processOutputs: (outputs) => sanitizeRootOutputs(outputs, mode),
    processChildLLMRunInputs: (inputs) => sanitizeChildInputs(inputs, mode),
    processChildLLMRunOutputs: (outputs) => sanitizeChildOutputs(outputs, mode),
  }
}

export function hashIdentifier(value) {
  if (value == null || value === '') return undefined
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 16)
}
