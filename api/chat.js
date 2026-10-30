import { openai } from '@ai-sdk/openai';
import { streamText, convertToModelMessages } from 'ai';
import { getSystemPrompt } from './prompt.js';
import {
  GUARDRAIL_MESSAGES,
  createRateLimiter,
  getLastUserText,
  hasUnsupportedParts,
  validateChatText,
} from '../shared/guardrails.js';

export const config = { runtime: 'edge' };

const rateLimiter = createRateLimiter();

function getSessionKey(req) {
  const sessionId = (req.headers.get('x-session-id') || 'anonymous').slice(0, 100);
  const forwarded = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
  const ip = forwarded.split(',')[0].trim() || 'unknown';
  return `${sessionId}|${ip}`;
}

function plainTextResponse(message, status, headers = {}) {
  return new Response(message, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', ...headers },
  });
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return plainTextResponse('Method Not Allowed', 405);
  }

  let messages;
  try {
    ({ messages } = await req.json());
  } catch {
    return plainTextResponse('Invalid request.', 400);
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return plainTextResponse('Invalid request.', 400);
  }

  if (hasUnsupportedParts(messages)) {
    return plainTextResponse(GUARDRAIL_MESSAGES.notPlain, 415);
  }

  const problem = validateChatText(getLastUserText(messages));
  if (problem) {
    const status = problem === GUARDRAIL_MESSAGES.tooLong ? 400 : 415;
    return plainTextResponse(problem, status);
  }

  const rate = rateLimiter.check(getSessionKey(req));
  if (rate.limited) {
    return plainTextResponse(
      `${GUARDRAIL_MESSAGES.tooMany} Try again in ${rate.retryAfter} second${rate.retryAfter === 1 ? '' : 's'}.`,
      429,
      { 'Retry-After': String(rate.retryAfter) },
    );
  }

  const result = streamText({
    model: openai(process.env.OPENAI_MODEL || 'gpt-4o-mini'),
    system: getSystemPrompt(),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
