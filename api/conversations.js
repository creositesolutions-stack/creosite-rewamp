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
  createConversation,
  listConversations,
} from '../server/conversations.js'

function conversationErrorResponse(error) {
  if (error instanceof ConversationError) {
    return errorResponse(error.code, error.message, error.status)
  }
  console.error('[conversations] Unexpected failure:', error instanceof Error ? error.message : error)
  return errorResponse('storage_error', 'Conversation storage is temporarily unavailable.', 503)
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

  try {
    if (request.method === 'GET') {
      const conversations = await listConversations(visitor.visitorId)
      return respond(jsonResponse({ conversations }))
    }

    if (request.method === 'POST') {
      const bodyResult = await readJsonBody(request)
      if (bodyResult.error) return respond(bodyResult.error)

      const conversation = await createConversation({
        visitorId: visitor.visitorId,
        title: bodyResult.value?.title,
      })
      return respond(jsonResponse({ conversation }, { status: 201 }))
    }

    return respond(errorResponse('method_not_allowed', 'Method not allowed.', 405))
  } catch (error) {
    return respond(conversationErrorResponse(error))
  }
}

export default createApiHandler(handleWebRequest)
