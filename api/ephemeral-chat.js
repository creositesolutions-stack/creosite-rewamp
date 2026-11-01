import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'
import { createRateLimiter, GUARDRAIL_MESSAGES, hasUnsupportedParts, validateChatHistory, validateChatText } from '../shared/guardrails.js'
import { createApiHandler, errorResponse, readJsonBody, textResponse } from '../server/http.js'
import { getClientIp } from '../server/request.js'
import { getSystemPrompt } from './prompt.js'
import { getLastUserMessage, getMessageText, toModelMessages, validateUiMessages } from '../server/messages.js'

export const config = { runtime: 'nodejs', maxDuration: 60 }

const rateLimiter = createRateLimiter({ max: 10, windowMs: 60_000 })
const ipRateLimiter = createRateLimiter({ max: 30, windowMs: 60_000 })

function getRateLimitKey(request, ip) {
  const sessionId = (request.headers.get('x-session-id') || 'anonymous').slice(0, 100)
  return `${ip}|${sessionId}`
}

export const ephemeralChatHandler = createApiHandler(async (request) => {
  if (request.method !== 'POST') return textResponse('Method Not Allowed', { status: 405 })

  const { value: body, error } = await readJsonBody(request)
  if (error) return error
  const messages = body?.messages
  if (!Array.isArray(messages) || messages.length === 0) return errorResponse('invalid_request', 'Invalid chat request.', 400)
  if (hasUnsupportedParts(messages)) return textResponse(GUARDRAIL_MESSAGES.notPlain, { status: 415 })

  const historyProblem = validateChatHistory(messages)
  if (historyProblem) {
    const status = historyProblem.startsWith('This conversation') || historyProblem === 'Invalid chat request.' || historyProblem === GUARDRAIL_MESSAGES.tooLong || historyProblem === GUARDRAIL_MESSAGES.empty ? 400 : 415
    return textResponse(historyProblem, { status })
  }

  let validatedMessages
  try {
    validatedMessages = await validateUiMessages(messages)
  } catch {
    return errorResponse('invalid_messages', 'Please send a plain text message.', 400)
  }

  const latestUserMessage = getLastUserMessage(validatedMessages)
  const text = getMessageText(latestUserMessage)
  const textProblem = validateChatText(text)
  if (textProblem) return textResponse(textProblem, { status: textProblem === GUARDRAIL_MESSAGES.tooLong ? 400 : 415 })

  const ip = getClientIp(request)
  const ipRate = ipRateLimiter.check(ip)
  if (ipRate.limited) {
    return errorResponse('rate_limited', `${GUARDRAIL_MESSAGES.tooMany} Try again in ${ipRate.retryAfter} seconds.`, 429, { 'Retry-After': String(ipRate.retryAfter) })
  }

  const rate = rateLimiter.check(getRateLimitKey(request, ip))
  if (rate.limited) {
    return errorResponse('rate_limited', `${GUARDRAIL_MESSAGES.tooMany} Try again in ${rate.retryAfter} seconds.`, 429, { 'Retry-After': String(rate.retryAfter) })
  }

  try {
    const result = await streamText({
      model: openai(process.env.OPENAI_MODEL || 'gpt-4o-mini'),
      system: getSystemPrompt(),
      messages: await toModelMessages(validatedMessages),
      maxOutputTokens: 500,
      abortSignal: request.signal,
    })
    return result.toUIMessageStreamResponse({ headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[ephemeral-chat] Generation failed:', error instanceof Error ? error.message : 'unknown error')
    return errorResponse('generation_failed', 'Sorry, I could not reply just now. Please try again.', 503)
  }
})

export default ephemeralChatHandler
