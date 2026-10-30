import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import chatHandler from './api/chat.js'

const distDir = fileURLToPath(new URL('./dist', import.meta.url))
const port = Number(process.env.PORT) || 3000

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

function toWebRequest(req) {
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value.join(',') : value)
  }
  const url = `http://${req.headers.host || 'localhost'}${req.url}`
  if (req.method === 'GET' || req.method === 'HEAD') {
    return new Request(url, { method: req.method, headers })
  }
  return new Request(url, { method: req.method, headers, body: Readable.toWeb(req), duplex: 'half' })
}

async function sendWebResponse(res, response) {
  res.statusCode = response.status
  response.headers.forEach((value, key) => res.setHeader(key, value))
  if (!response.body) {
    res.end()
    return
  }
  const reader = response.body.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(Buffer.from(value))
    }
  } finally {
    res.end()
  }
}

async function serveStatic(req, res) {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  const file = normalize(join(distDir, pathname))
  if (!file.startsWith(distDir)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  try {
    const info = await stat(file)
    const target = info.isDirectory() ? join(file, 'index.html') : file
    const body = await readFile(target)
    res.writeHead(200, { 'Content-Type': contentTypes[extname(target)] || 'application/octet-stream' })
    res.end(body)
    return
  } catch {}

  if (extname(pathname)) {
    res.writeHead(404)
    res.end('Not found')
    return
  }

  try {
    const body = await readFile(join(distDir, 'index.html'))
    res.writeHead(200, { 'Content-Type': contentTypes['.html'] })
    res.end(body)
  } catch {
    res.writeHead(404)
    res.end('Not found')
  }
}

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost')
  if (pathname === '/api/chat') {
    try {
      await sendWebResponse(res, await chatHandler(toWebRequest(req)))
    } catch (error) {
      console.error(error)
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Internal Server Error')
    }
    return
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405)
    res.end('Method Not Allowed')
    return
  }
  await serveStatic(req, res)
})

server.listen(port, () => {
  console.log(`Creosite running at http://localhost:${port}`)
})
