import { randomUUID } from 'node:crypto'
import { convertToModelMessages, validateUIMessages } from 'ai'

export function partsToText(parts) {
  if (!Array.isArray(parts)) return ''
  return parts
    .filter((part) => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join(' ')
    .trim()
}

export function getMessageText(message) {
  if (!message || typeof message !== 'object') return ''
  const fromParts = partsToText(message.parts)
  if (fromParts) return fromParts
  return typeof message.content === 'string' ? message.content.trim() : ''
}

export function getLastUserMessage(messages) {
  if (!Array.isArray(messages)) return null
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') return messages[index]
  }
  return null
}

export function normalizeUserMessage(message) {
  const text = getMessageText(message)
  const id = typeof message?.id === 'string' && message.id.trim() ? message.id.trim().slice(0, 200) : randomUUID()
  return {
    id,
    role: 'user',
    parts: [{ type: 'text', text }],
  }
}

export function sanitizeParts(parts) {
  if (!Array.isArray(parts)) return []
  try {
    const serializable = JSON.parse(JSON.stringify(parts))
    return Array.isArray(serializable) ? serializable : []
  } catch {
    return []
  }
}

export function messageToRecord(message) {
  if (!message || typeof message !== 'object') return null
  const parts = sanitizeParts(message.parts)
  const content = partsToText(parts) || getMessageText(message)
  if (!content) return null

  return {
    uiId: typeof message.id === 'string' && message.id.trim() ? message.id.trim().slice(0, 200) : randomUUID(),
    role: message.role === 'assistant' ? 'assistant' : 'user',
    content,
    parts: parts.length > 0 ? parts : [{ type: 'text', text: content }],
  }
}

export function deriveConversationTitle(text) {
  const value = String(text || '').replace(/\s+/g, ' ').trim()
  if (!value) return 'New conversation'
  return value.length > 60 ? `${value.slice(0, 57).trimEnd()}...` : value
}

export function isNewConversationTitle(title) {
  const value = String(title || '').trim()
  return !value || value === 'New conversation'
}

export async function validateUiMessages(messages) {
  return validateUIMessages({ messages })
}

export function toModelMessages(messages) {
  return convertToModelMessages(messages)
}
