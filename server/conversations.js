import { randomUUID } from 'node:crypto'
import { getSupabaseAdmin, isStorageConfigured } from './supabase.js'
import { isUuid } from './visitor.js'

export class ConversationError extends Error {
  constructor(code, status, message) {
    super(message)
    this.name = 'ConversationError'
    this.code = code
    this.status = status
  }
}

function requireClient() {
  const client = getSupabaseAdmin()
  if (!client) {
    throw new ConversationError('storage_not_configured', 503, 'Conversation storage is not configured.')
  }
  return client
}

function storageFailure(operation, error) {
  console.error(`[conversations] ${operation} failed:`, error?.message || 'unknown error')
  return new ConversationError('storage_error', 503, 'Conversation storage is temporarily unavailable.')
}

function assertConversationId(conversationId) {
  if (!isUuid(conversationId)) {
    throw new ConversationError('invalid_conversation_id', 400, 'Invalid conversation ID.')
  }
}

function assertVisitorId(visitorId) {
  if (!isUuid(visitorId)) {
    throw new ConversationError('invalid_visitor', 401, 'A valid visitor session is required.')
  }
}

export function normalizeTitle(title) {
  const value = String(title || '').replace(/\s+/g, ' ').trim()
  return value.slice(0, 120)
}

function mapConversation(row) {
  if (!row) return null
  return {
    id: row.id,
    title: row.title || 'New conversation',
    status: row.status || 'active',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapMessage(row) {
  const parts = Array.isArray(row.parts) && row.parts.length > 0
    ? row.parts
    : [{ type: 'text', text: row.content || '' }]

  return {
    id: row.ui_id || row.id,
    role: row.role,
    parts,
  }
}

export async function createConversation({ visitorId, title }) {
  assertVisitorId(visitorId)
  const client = requireClient()
  const { data, error } = await client
    .from('conversations')
    .insert({
      visitor_id: visitorId,
      title: normalizeTitle(title) || 'New conversation',
      status: 'active',
    })
    .select('id,title,status,created_at,updated_at')
    .single()

  if (error) throw storageFailure('createConversation', error)
  return mapConversation(data)
}

export async function listConversations(visitorId, { limit = 50 } = {}) {
  assertVisitorId(visitorId)
  const client = requireClient()
  const { data, error } = await client
    .from('conversations')
    .select('id,title,status,created_at,updated_at')
    .eq('visitor_id', visitorId)
    .neq('status', 'deleted')
    .order('updated_at', { ascending: false })
    .limit(Math.min(Math.max(Number(limit) || 50, 1), 100))

  if (error) throw storageFailure('listConversations', error)
  return (data || []).map(mapConversation)
}

export async function getConversationForVisitor(conversationId, visitorId) {
  assertConversationId(conversationId)
  assertVisitorId(visitorId)
  const client = requireClient()
  const { data, error } = await client
    .from('conversations')
    .select('id,title,status,created_at,updated_at')
    .eq('id', conversationId)
    .eq('visitor_id', visitorId)
    .neq('status', 'deleted')
    .maybeSingle()

  if (error) throw storageFailure('getConversation', error)
  return mapConversation(data)
}

export async function requireConversationForVisitor(conversationId, visitorId) {
  const conversation = await getConversationForVisitor(conversationId, visitorId)
  if (!conversation) {
    throw new ConversationError('conversation_not_found', 404, 'Conversation not found.')
  }
  return conversation
}

export async function getConversationMessages(conversationId, { limit = 500 } = {}) {
  assertConversationId(conversationId)
  const client = requireClient()
  const { data, error } = await client
    .from('messages')
    .select('id,ui_id,role,content,parts,created_at,seq')
    .eq('conversation_id', conversationId)
    .order('seq', { ascending: true })
    .limit(Math.min(Math.max(Number(limit) || 500, 1), 1000))

  if (error) throw storageFailure('getConversationMessages', error)
  return (data || []).map(mapMessage)
}

export async function findMessageByUiId(conversationId, uiId) {
  if (!uiId) return null
  assertConversationId(conversationId)
  const client = requireClient()
  const { data, error } = await client
    .from('messages')
    .select('id,ui_id,role,content,parts,created_at,seq')
    .eq('conversation_id', conversationId)
    .eq('ui_id', uiId)
    .maybeSingle()

  if (error) throw storageFailure('findMessageByUiId', error)
  return data ? mapMessage(data) : null
}

export async function appendMessage({ conversationId, uiId, role, content, parts }) {
  assertConversationId(conversationId)
  const client = requireClient()
  const row = {
    conversation_id: conversationId,
    ui_id: uiId ? String(uiId).slice(0, 200) : randomUUID(),
    role,
    content: String(content || ''),
    parts: Array.isArray(parts) ? parts : [],
  }

  const { data, error } = await client
    .from('messages')
    .insert(row)
    .select('id,ui_id,role,content,parts,created_at,seq')
    .single()

  if (error) {
    if (error.code === '23505' && row.ui_id) {
      const existing = await findMessageByUiId(conversationId, row.ui_id)
      if (existing) return existing
    }
    throw storageFailure('appendMessage', error)
  }

  return mapMessage(data)
}

export async function deleteLastAssistantMessage(conversationId) {
  assertConversationId(conversationId)
  const client = requireClient()
  const { data, error } = await client
    .from('messages')
    .select('id,role')
    .eq('conversation_id', conversationId)
    .order('seq', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw storageFailure('findLastMessage', error)
  if (!data || data.role !== 'assistant') return false

  const { error: deleteError } = await client
    .from('messages')
    .delete()
    .eq('id', data.id)
    .eq('conversation_id', conversationId)

  if (deleteError) throw storageFailure('deleteLastAssistantMessage', deleteError)
  return true
}

export async function updateConversation(conversationId, { title } = {}) {
  assertConversationId(conversationId)
  const client = requireClient()
  const updates = { updated_at: new Date().toISOString() }
  if (title != null) updates.title = normalizeTitle(title)

  const { data, error } = await client
    .from('conversations')
    .update(updates)
    .eq('id', conversationId)
    .select('id,title,status,created_at,updated_at')
    .maybeSingle()

  if (error) throw storageFailure('updateConversation', error)
  return mapConversation(data)
}

export async function renameConversation(conversationId, visitorId, title) {
  assertConversationId(conversationId)
  assertVisitorId(visitorId)
  const nextTitle = normalizeTitle(title)
  if (!nextTitle) {
    throw new ConversationError('invalid_title', 400, 'Please provide a conversation title.')
  }

  const client = requireClient()
  const { data, error } = await client
    .from('conversations')
    .update({ title: nextTitle, updated_at: new Date().toISOString() })
    .eq('id', conversationId)
    .eq('visitor_id', visitorId)
    .neq('status', 'deleted')
    .select('id,title,status,created_at,updated_at')
    .maybeSingle()

  if (error) throw storageFailure('renameConversation', error)
  if (!data) throw new ConversationError('conversation_not_found', 404, 'Conversation not found.')
  return mapConversation(data)
}

export async function deleteConversation(conversationId, visitorId) {
  assertConversationId(conversationId)
  assertVisitorId(visitorId)
  const client = requireClient()
  const { data, error } = await client
    .from('conversations')
    .delete()
    .eq('id', conversationId)
    .eq('visitor_id', visitorId)
    .select('id')
    .maybeSingle()

  if (error) throw storageFailure('deleteConversation', error)
  if (!data) throw new ConversationError('conversation_not_found', 404, 'Conversation not found.')
  return true
}

export async function purgeExpiredConversations(retentionDays) {
  const days = Number(retentionDays)
  if (!Number.isFinite(days) || days <= 0) {
    throw new ConversationError('invalid_retention', 400, 'Retention days must be a positive number.')
  }
  if (!isStorageConfigured()) return 0

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const client = requireClient()
  const { data, error } = await client
    .from('conversations')
    .delete()
    .lt('updated_at', cutoff)
    .select('id')

  if (error) throw storageFailure('purgeExpiredConversations', error)
  return data?.length || 0
}
