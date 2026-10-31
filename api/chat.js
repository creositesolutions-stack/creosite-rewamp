import { openai } from '@ai-sdk/openai'
import { createUIMessageStreamResponse, generateId, toUIMessageStream } from 'ai'
import { getSystemPrompt } from './prompt.js'
import {
  GUARDRAIL_MESSAGES,
  createRateLimiter,
  getLastUserText,
  hasUnsupportedParts,
  validateChatText,
} from '../shared/guardrails.js'
import {
  createApiHandler,
  readJsonBody,
  textResponse,
  withVisitorCookie,
} from '../server/http.js'
import { getVisitorIdentity, hasVisitorCookieSecret, isUuid } from '../server/visitor.js'
import { isStorageConfigured } from '../server/supabase.js'
import {
  ConversationError,
  appendMessage,
  deleteLastAssistantMessage,
  findMessageByUiId,
  getConversationMessages,
  requireConversationForVisitor,
  updateConversation,
} from '../server/conversations.js'
import {
  deriveConversationTitle,
  getLastUserMessage,
  getMessageText,
  isNewConversationTitle,
  messageToRecord,
  normalizeUserMessage,
  toModelMessages,
  validateUiMessages,
} from '../server/messages.js'
import {
  createRunProviderOptions,
  finishChatTurn,
  finishTraceStep,
  scheduleLangSmithFlush,
  startChatTurnTrace,
  startTraceStep,
  traceStep,
} from '../server/langsmith.js'
import { getTracingPrivacyMode, hashIdentifier, redactText } from '../server/privacy.js'

export const config = { runtime: 'nodejs', maxDuration: 60 }

const rateLimiter = createRateLimiter()

function getSessionId(req) {
  return (req.headers.get('x-session-id') || 'anonymous').slice(0, 100)
}

function getSessionKey(req, visitorId) {
  const sessionId = getSessionId(req)
  const forwarded = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || ''
  const ip = (forwarded.split(',')[0].trim() || 'unknown').slice(0, 64)
  return `${visitorId || 'anonymous'}|${sessionId}|${ip}`
}

function getModelId() {
  return process.env.OPENAI_MODEL || 'gpt-4o-mini'
}

function getEnvironment() {
  return process.env.APP_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV || 'development'
}

function safeErrorMessage(error) {
  return redactText(error instanceof Error ? error.message : String(error))
}

function chatErrorResponse(error) {
  if (error instanceof ConversationError) {
    if (error.code === 'conversation_not_found') {
      return textResponse('Conversation not found.', { status: 404 })
    }
    if (error.code === 'invalid_conversation_id') {
      return textResponse('Invalid conversation.', { status: 400 })
    }
    if (error.code === 'storage_not_configured') {
      return textResponse('Conversation storage is not configured.', { status: 503 })
    }
  }
  return textResponse('Sorry, something went wrong. Please try again.', { status: 503 })
}

function rateLimitResponse(rate) {
  return textResponse(
    `${GUARDRAIL_MESSAGES.tooMany} Try again in ${rate.retryAfter} second${rate.retryAfter === 1 ? '' : 's'}.`,
    { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } },
  )
}

function buildTurnMetadata({ conversationId, sessionId, modelId }) {
  return {
    application: 'creo',
    environment: getEnvironment(),
    conversation_id: conversationId,
    thread_id: conversationId,
    session_id: hashIdentifier(sessionId),
    model: modelId,
    endpoint: '/api/chat',
  }
}

async function createAssistantResponse({
  request,
  root,
  runtime,
  mode,
  modelId,
  turnMetadata,
  systemPrompt,
  uiMessages,
  modelMessages,
  conversationId,
  onCompleted,
}) {
  const streamingRun = await startTraceStep(root, {
    name: 'Response Streaming',
    inputs: { model: modelId },
    metadata: { conversationId },
    mode,
  })

  let streamResult
  try {
    streamResult = await runtime.sdk.streamText({
      model: openai(modelId),
      system: systemPrompt,
      messages: modelMessages,
      abortSignal: request.signal,
      providerOptions: createRunProviderOptions(runtime, {
        parentRun: root,
        metadata: turnMetadata,
        name: 'Model Call',
        tags: ['chat-turn'],
      }),
    })
  } catch (error) {
    await finishTraceStep(streamingRun, { error, mode })
    throw error
  }

  const uiStream = toUIMessageStream({
    stream: streamResult.stream,
    originalMessages: uiMessages,
    generateMessageId: generateId,
    onError: (error) => {
      console.error('[chat] Stream failure:', safeErrorMessage(error))
      return 'Sorry, I could not reply just now.'
    },
    onEnd: async ({ responseMessage, outcome, isAborted, isCancelled }) => {
      const status = outcome?.status || 'unknown'
      const completed = status === 'completed' && !isAborted && !isCancelled
      const record = messageToRecord(responseMessage)
      let persistenceError = null
      let saved = false

      if (completed && onCompleted) {
        try {
          saved = await onCompleted(record)
        } catch (error) {
          persistenceError = error
          console.error('[chat] Message persistence failed:', safeErrorMessage(error))
        }
      }

      await finishTraceStep(streamingRun, {
        outputs: {
          status,
          aborted: Boolean(isAborted || isCancelled),
          saved,
          contentLength: record?.content?.length || 0,
        },
        mode,
      })

      await finishChatTurn(root, {
        outputs: {
          status,
          saved,
          messageCount: uiMessages.length + (saved ? 1 : 0),
          input: getLastUserText(uiMessages),
          output: record?.content,
        },
        error: persistenceError,
        mode,
      })

      scheduleLangSmithFlush(mode)
    },
  })

  const headers = { 'Cache-Control': 'no-store' }
  if (conversationId) headers['X-Conversation-Id'] = conversationId
  return createUIMessageStreamResponse({ stream: uiStream, headers })
}

async function handlePersistentChat({ request, body, visitor, latestUserMessage, userText, sessionId }) {
  const mode = getTracingPrivacyMode()
  const modelId = getModelId()
  const conversationId = typeof body.conversationId === 'string' ? body.conversationId.trim() : ''
  const trigger = body.trigger === 'regenerate-message' ? 'regenerate-message' : 'submit-message'

  if (!conversationId) {
    return textResponse('A conversation is required.', { status: 400 })
  }

  let conversation
  try {
    conversation = await requireConversationForVisitor(conversationId, visitor.visitorId)
  } catch (error) {
    return chatErrorResponse(error)
  }

  const turnMetadata = buildTurnMetadata({ conversationId, sessionId, modelId })
  const { root, runtime } = await startChatTurnTrace({
    metadata: turnMetadata,
    inputs: { message: userText },
    tags: ['chat-turn'],
    mode,
  })

  try {
    const guardrail = await traceStep(root, {
      name: 'Guardrail Validation',
      inputs: { messageLength: userText.length },
      metadata: { conversationId },
      mode,
    }, async () => {
      if (hasUnsupportedParts([latestUserMessage])) {
        return { problem: GUARDRAIL_MESSAGES.notPlain, status: 415, code: 'not_plain' }
      }
      const problem = validateChatText(userText)
      if (!problem) return { problem: '', status: 200, code: 'passed' }
      return {
        problem,
        status: problem === GUARDRAIL_MESSAGES.tooLong ? 400 : 415,
        code: problem === GUARDRAIL_MESSAGES.tooLong ? 'too_long' : 'not_plain',
      }
    })

    if (guardrail.problem) {
      await finishChatTurn(root, { outputs: { status: 'rejected', reason: guardrail.code }, mode })
      scheduleLangSmithFlush(mode)
      return textResponse(guardrail.problem, { status: guardrail.status })
    }

    const rate = rateLimiter.check(getSessionKey(request, visitor.visitorId))
    if (rate.limited) {
      await finishChatTurn(root, { outputs: { status: 'rate_limited' }, mode })
      scheduleLangSmithFlush(mode)
      return rateLimitResponse(rate)
    }

    const userMessage = normalizeUserMessage(latestUserMessage)
    let storedMessages = []
    let appendedUserMessage = false

    await traceStep(root, {
      name: 'Conversation History Loading',
      inputs: { trigger },
      metadata: { conversationId },
      mode,
    }, async () => {
      if (trigger === 'regenerate-message') {
        await deleteLastAssistantMessage(conversationId)
      }

      const existing = await findMessageByUiId(conversationId, userMessage.id)
      if (!existing) {
        await appendMessage({
          conversationId,
          uiId: userMessage.id,
          role: 'user',
          content: userText,
          parts: userMessage.parts,
        })
        appendedUserMessage = true
      }

      storedMessages = await getConversationMessages(conversationId)

      if (appendedUserMessage && isNewConversationTitle(conversation.title)) {
        try {
          await updateConversation(conversationId, { title: deriveConversationTitle(userText) })
        } catch (error) {
          console.warn('[chat] Could not update conversation title:', safeErrorMessage(error))
        }
      }

      return {
        messageCount: storedMessages.length,
        appendedUserMessage,
        regenerated: trigger === 'regenerate-message',
      }
    })

    const systemPrompt = getSystemPrompt()
    let uiMessages = []
    let modelMessages = []

    await traceStep(root, {
      name: 'Prompt Construction',
      inputs: { messageCount: storedMessages.length },
      metadata: { conversationId },
      mode,
    }, async () => {
      uiMessages = await validateUiMessages(storedMessages)
      if (!uiMessages.some((message) => message.role === 'user')) {
        throw new Error('No user message found in conversation history.')
      }
      modelMessages = await toModelMessages(uiMessages)
      return { systemPromptLength: systemPrompt.length, modelMessageCount: modelMessages.length }
    })

    const response = await createAssistantResponse({
      request,
      root,
      runtime,
      mode,
      modelId,
      turnMetadata,
      systemPrompt,
      uiMessages,
      modelMessages,
      conversationId,
      onCompleted: async (record) => {
        if (!record) return false

        await traceStep(root, {
          name: 'Message Persistence',
          inputs: { assistantMessageId: record.uiId, contentLength: record.content.length },
          metadata: { conversationId },
          mode,
        }, async () => {
          await appendMessage({ conversationId, ...record })
          try {
            await updateConversation(conversationId, {})
          } catch (error) {
            console.warn('[chat] Could not update conversation timestamp:', safeErrorMessage(error))
          }
          return { saved: true, contentLength: record.content.length }
        })

        return true
      },
    })

    return response
  } catch (error) {
    console.error('[chat] Chat turn failed:', safeErrorMessage(error))
    await finishChatTurn(root, { error, mode })
    scheduleLangSmithFlush(mode)
    return chatErrorResponse(error)
  }
}

async function handleWebRequest(request) {
  if (request.method !== 'POST') {
    return textResponse('Method Not Allowed', { status: 405 })
  }

  if (!hasVisitorCookieSecret()) {
    return textResponse('Conversation security is not configured.', { status: 503 })
  }

  const visitor = getVisitorIdentity(request)
  const response = await (async () => {
    const bodyResult = await readJsonBody(request)
    if (bodyResult.error) return bodyResult.error

    const body = bodyResult.value || {}
    const messages = body.messages
    if (!Array.isArray(messages) || messages.length === 0) {
      return textResponse('Invalid request.', { status: 400 })
    }

    const latestUserMessage = getLastUserMessage(messages)
    if (!latestUserMessage) {
      return textResponse('Invalid request.', { status: 400 })
    }

    const userText = getMessageText(latestUserMessage)
    if (!userText) {
      return textResponse(GUARDRAIL_MESSAGES.empty, { status: 400 })
    }

    const sessionId = getSessionId(request)

    if (!isStorageConfigured()) {
      return textResponse('Conversation storage is temporarily unavailable. Please try again later.', { status: 503 })
    }

    return handlePersistentChat({ request, body, visitor, latestUserMessage, userText, sessionId })
  })()

  return withVisitorCookie(response, visitor.setCookie)
}

export default createApiHandler(handleWebRequest)
