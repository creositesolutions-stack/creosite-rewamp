import { Readable } from 'node:stream'

const MAX_BODY_BYTES = 1_000_000

export function jsonResponse(data, { status = 200, headers = {} } = {}) {
  const responseHeaders = new Headers(headers)
  responseHeaders.set('Content-Type', 'application/json; charset=utf-8')
  responseHeaders.set('Cache-Control', 'no-store')
  return new Response(JSON.stringify(data), { status, headers: responseHeaders })
}

export function textResponse(message, { status = 200, headers = {} } = {}) {
  const responseHeaders = new Headers(headers)
  responseHeaders.set('Content-Type', 'text/plain; charset=utf-8')
  responseHeaders.set('Cache-Control', 'no-store')
  return new Response(message, { status, headers: responseHeaders })
}

export function errorResponse(code, message, status = 400, headers = {}) {
  return jsonResponse({ error: code, message }, { status, headers })
}

export function withVisitorCookie(response, setCookie) {
  if (!setCookie) return response
  try {
    response.headers.append('Set-Cookie', setCookie)
  } catch {
    return response
  }
  return response
}

export async function readJsonBody(request) {
  const length = Number(request.headers.get('content-length') || 0)
  if (length > MAX_BODY_BYTES) {
    return { error: errorResponse('payload_too_large', 'Request body is too large.', 413) }
  }

  try {
    const text = await request.text()
    if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) {
      return { error: errorResponse('payload_too_large', 'Request body is too large.', 413) }
    }
    if (!text) return { value: {} }
    return { value: JSON.parse(text) }
  } catch {
    return { error: errorResponse('invalid_json', 'Invalid request.', 400) }
  }
}

function toWebRequest(req, signal) {
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue
    headers.set(key, Array.isArray(value) ? value.join(',') : String(value))
  }

  const host = req.headers.host || 'localhost'
  const url = `http://${host}${req.url || '/'}`
  const method = req.method || 'GET'

  if (method === 'GET' || method === 'HEAD') {
    return new Request(url, { method, headers, signal })
  }

  if (req.body !== undefined) {
    const body = Buffer.isBuffer(req.body) || typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body)
    return new Request(url, { method, headers, body, signal })
  }

  return new Request(url, {
    method,
    headers,
    body: Readable.toWeb(req),
    duplex: 'half',
    signal,
  })
}

async function writeWebResponse(res, response) {
  res.statusCode = response.status
  for (const [key, value] of response.headers.entries()) {
    if (key.toLowerCase() === 'set-cookie') continue
    res.setHeader(key, value)
  }

  const setCookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : []
  if (setCookies.length > 0) res.setHeader('Set-Cookie', setCookies)

  if (!response.body) {
    res.end()
    return
  }

  const reader = response.body.getReader()
  const cancelStream = () => {
    reader.cancel().catch(() => {})
  }
  res.on('close', cancelStream)

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (res.writableEnded || res.destroyed) break
      res.write(Buffer.from(value))
    }
  } finally {
    res.removeListener('close', cancelStream)
    if (!res.writableEnded) res.end()
  }
}

export async function serveNodeRequest(webHandler, req, res) {
  const controller = new AbortController()
  const abortOnClose = () => {
    if (!res.writableEnded) controller.abort()
  }
  res.on('close', abortOnClose)

  try {
    const request = toWebRequest(req, controller.signal)
    const response = await webHandler(request)
    await writeWebResponse(res, response)
  } catch (error) {
    console.error('[api] Request failed:', error instanceof Error ? error.message : error)
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    }
    if (!res.writableEnded) res.end('Internal Server Error')
  } finally {
    res.removeListener('close', abortOnClose)
  }
}

export function createApiHandler(webHandler) {
  return async function handler(reqOrRequest, res) {
    if (res && typeof res.write === 'function') {
      return serveNodeRequest(webHandler, reqOrRequest, res)
    }
    return webHandler(reqOrRequest)
  }
}
