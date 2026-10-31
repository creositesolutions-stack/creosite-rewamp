import * as ai from 'ai'
import { Client } from 'langsmith'
import { RunTree } from 'langsmith/run_trees'
import { createLangSmithProviderOptions, wrapAISDK } from 'langsmith/experimental/vercel'
import { waitUntil } from '@vercel/functions'
import {
  getLangSmithPrivacyConfig,
  getTracingPrivacyMode,
  sanitizeValue,
} from './privacy.js'

const wrappedByMode = new Map()
const clientByMode = new Map()

function readTracingFlag() {
  const keys = [
    'LANGSMITH_TRACING',
    'LANGSMITH_TRACING_V2',
    'LANGCHAIN_TRACING_V2',
    'LANGCHAIN_TRACING',
  ]

  for (const key of keys) {
    const value = process.env[key]
    if (value != null && value !== '') return /^true$/i.test(value)
  }
  return null
}

export function getLangSmithConfig() {
  const apiKey = process.env.LANGSMITH_API_KEY || process.env.LANGCHAIN_API_KEY || ''
  const project = process.env.LANGSMITH_PROJECT || process.env.LANGCHAIN_PROJECT || 'creo'
  const flag = readTracingFlag()
  const mode = getTracingPrivacyMode()

  return {
    apiKey,
    apiUrl: process.env.LANGSMITH_ENDPOINT || process.env.LANGCHAIN_ENDPOINT || '',
    project,
    mode,
    enabled: Boolean(apiKey) && flag !== false && mode !== 'DISABLED',
  }
}

function getClient(mode) {
  const config = getLangSmithConfig()
  if (!config.enabled) return null

  const cacheKey = `${mode}:${config.apiUrl}:${config.project}:${config.apiKey.slice(-8)}`
  if (clientByMode.has(cacheKey)) return clientByMode.get(cacheKey)

  const client = new Client({
    apiKey: config.apiKey,
    ...(config.apiUrl ? { apiUrl: config.apiUrl } : {}),
    hideInputs: mode === 'METADATA_ONLY',
    hideOutputs: mode === 'METADATA_ONLY',
    timeout_ms: 15_000,
  })
  clientByMode.set(cacheKey, client)
  return client
}

function getWrappedAI(mode) {
  const config = getLangSmithConfig()
  if (!config.enabled) return ai

  const client = getClient(mode)
  if (!client) return ai

  const privacy = getLangSmithPrivacyConfig(mode)
  const cacheKey = `${mode}:${config.apiUrl}:${config.project}:${config.apiKey.slice(-8)}`
  if (wrappedByMode.has(cacheKey)) {
    return wrappedByMode.get(cacheKey)
  }

  try {
    const wrapped = wrapAISDK(ai, {
      client,
      project_name: config.project,
      traceRawHttp: false,
      processInputs: privacy.processInputs,
      processOutputs: privacy.processOutputs,
      processChildLLMRunInputs: privacy.processChildLLMRunInputs,
      processChildLLMRunOutputs: privacy.processChildLLMRunOutputs,
    })
    wrappedByMode.set(cacheKey, wrapped)
    return wrapped
  } catch (error) {
    console.warn('[langsmith] Could not initialize tracing:', error instanceof Error ? error.message : error)
    return ai
  }
}

export function getTracingRuntime(mode = getTracingPrivacyMode()) {
  const config = getLangSmithConfig()
  const privacy = getLangSmithPrivacyConfig(mode)

  if (!config.enabled || !privacy.enabled) {
    return { enabled: false, mode, client: null, sdk: ai, project: config.project }
  }

  const client = getClient(mode)
  if (!client) {
    return { enabled: false, mode, client: null, sdk: ai, project: config.project }
  }

  return {
    enabled: true,
    mode,
    client,
    sdk: getWrappedAI(mode),
    project: config.project,
  }
}

function safeInputs(value, mode) {
  if (mode === 'METADATA_ONLY') return { redacted: true }
  return sanitizeValue(value, { mode })
}

function safeOutputs(value, mode) {
  if (mode === 'METADATA_ONLY') return { redacted: true }
  return sanitizeValue(value, { mode })
}

export async function startChatTurnTrace({ metadata, inputs, name = 'Creo Chat Turn', tags = [], mode = getTracingPrivacyMode() }) {
  const runtime = getTracingRuntime(mode)
  if (!runtime.enabled) return { root: null, runtime }

  try {
    const root = new RunTree({
      name,
      run_type: 'chain',
      client: runtime.client,
      project_name: runtime.project,
      tracingEnabled: true,
      tags: ['creosite', 'chatbot', ...tags],
      metadata,
      inputs: safeInputs(inputs, mode),
    })
    root.postRun().catch((error) => {
      console.warn('[langsmith] Could not post trace root:', error instanceof Error ? error.message : error)
    })
    return { root, runtime }
  } catch (error) {
    console.warn('[langsmith] Could not start trace:', error instanceof Error ? error.message : error)
    return { root: null, runtime }
  }
}

export async function startTraceStep(parent, { name, runType = 'chain', inputs, metadata, tags = [], mode }) {
  if (!parent) return null

  try {
    const child = parent.createChild({
      name,
      run_type: runType,
      tags,
      metadata,
      inputs: safeInputs(inputs, mode),
    })
    child.postRun().catch((error) => {
      console.warn(`[langsmith] Could not post step "${name}":`, error instanceof Error ? error.message : error)
    })
    return child
  } catch (error) {
    console.warn(`[langsmith] Could not start step "${name}":`, error instanceof Error ? error.message : error)
    return null
  }
}

export async function finishTraceStep(child, { outputs, error, mode } = {}) {
  if (!child) return
  try {
    const errorMessage = error
      ? String(sanitizeValue({ error: error instanceof Error ? error.message : String(error) }, { mode }).error)
      : undefined
    await child.end(error ? undefined : safeOutputs(outputs, mode), errorMessage)
    child.patchRun().catch((patchError) => {
      console.warn('[langsmith] Could not patch step:', patchError instanceof Error ? patchError.message : patchError)
    })
  } catch (patchError) {
    console.warn('[langsmith] Could not finish step:', patchError instanceof Error ? patchError.message : patchError)
  }
}

export async function traceStep(parent, { name, runType = 'chain', inputs, metadata, tags = [], mode }, fn) {
  const child = await startTraceStep(parent, { name, runType, inputs, metadata, tags, mode })
  if (!child) return fn()

  try {
    const result = await fn()
    await finishTraceStep(child, { outputs: result, mode })
    return result
  } catch (error) {
    await finishTraceStep(child, { error, mode })
    throw error
  }
}

export async function finishChatTurn(root, { outputs, error, mode = getTracingPrivacyMode() } = {}) {
  if (!root) return

  try {
    const errorMessage = error
      ? String(sanitizeValue({ error: error instanceof Error ? error.message : String(error) }, { mode }).error)
      : undefined
    await root.end(error ? undefined : safeOutputs(outputs, mode), errorMessage)
    root.patchRun().catch((patchError) => {
      console.warn('[langsmith] Could not patch trace:', patchError instanceof Error ? patchError.message : patchError)
    })
  } catch (patchError) {
    console.warn('[langsmith] Could not finish trace:', patchError instanceof Error ? patchError.message : patchError)
  }
}

export function scheduleLangSmithFlush(mode = getTracingPrivacyMode()) {
  const runtime = getTracingRuntime(mode)
  if (!runtime.enabled) return

  const task = (async () => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 50))
      await runtime.client.awaitPendingTraceBatches()
    } catch (error) {
      console.warn('[langsmith] Could not flush traces:', error instanceof Error ? error.message : error)
    }
  })()

  try {
    waitUntil(task)
  } catch {
    task.catch(() => {})
  }
}

export async function flushLangSmith(mode = getTracingPrivacyMode()) {
  const runtime = getTracingRuntime(mode)
  if (!runtime.enabled) return
  try {
    await runtime.client.awaitPendingTraceBatches()
  } catch (error) {
    console.warn('[langsmith] Could not flush traces:', error instanceof Error ? error.message : error)
  }
}

export function createRunProviderOptions(runtime, { parentRun, metadata, name = 'Model Call', tags = [] } = {}) {
  if (!runtime?.enabled) return undefined
  return {
    langsmith: createLangSmithProviderOptions({
      parent_run: parentRun || undefined,
      metadata,
      name,
      tags,
      traceRawHttp: false,
    }),
  }
}

export function isLangSmithEnabled() {
  return getLangSmithConfig().enabled
}
