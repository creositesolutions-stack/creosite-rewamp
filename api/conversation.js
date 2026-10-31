import {
  createApiHandler,
  errorResponse,
  jsonResponse,
  readJsonBody,
  withVisitorCookie,
} from '../server/http.js'
import { getVisitorIdentity, hasVisitorCookieSecret } from '../server/visitor.js'
import { isStorageConfigured } from '../server/supabase.js'
import {
  ConversationError,
  deleteConversation,
  getConversationMessages,
  renameConversation,
  requireConversationForVisitor,
} from '../server/conversations.js'

function conversationErrorResponse(error) {
  if (error instanceof ConversationError) {
    return errorResponse(error.code, error.message, error.status)
  }
  console.error('[conversation] Unexpected failure:', error instanceof Error ? error.message : error)
  return errorResponse('storage_error', 'Conversation storage is temporarily unavailable.', 503)
}

function getConversationId(request) {
  try {
    return new URL(request.url).searchParams.get('id') || ''
  } catch {
    return ''
  }
}

async function handleWebRequest(request) {
  if (!hasVisitorCookieSecret()) {
    return errorResponse('security_not_configured', 'Conversation security is not configured.', 503)
  }
  const visitor = getVisitorIdentity(request)
  const respond = (response) => withVisitorCookie(response, visitor.setCookie)

  if (!isStorageConfigured()) {
    return respond(errorResponse(
      'storage_not_configured',
      'Conversation storage is not configured.',
      503,
    ))
  }

  if (!['GET', 'PATCH', 'DELETE'].includes(request.method)) {
    return respond(errorResponse('method_not_allowed', 'Method not allowed.', 405))
  }

  const conversationId = getConversationId(request)
  if (!conversationId) {
    return respond(errorResponse('conversation_required', 'A conversation ID is required.', 400))
  }

  try {
    if (request.method === 'GET') {
      const conversation = await requireConversationForVisitor(conversationId, visitor.visitorId)
      const messages = await getConversationMessages(conversationId)
      return respond(jsonResponse({ conversation, messages }))
    }

    if (request.method === 'PATCH') {
      const bodyResult = await readJsonBody(request)
      if (bodyResult.error) return respond(bodyResult.error)
      const conversation = await renameConversation(
        conversationId,
        visitor.visitorId,
        bodyResult.value?.title,
      )
      return respond(jsonResponse({ conversation }))
    }

    if (request.method === 'DELETE') {
      await deleteConversation(conversationId, visitor.visitorId)
      return respond(jsonResponse({ ok: true }))
    }

    return respond(errorResponse('method_not_allowed', 'Method not allowed.', 405))
  } catch (error) {
    return respond(conversationErrorResponse(error))
  }
}

export default createApiHandler(handleWebRequest)
