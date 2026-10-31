import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import chatHandler from './api/chat.js'
import contactHandler from './api/contact.js'
import conversationsHandler from './api/conversations.js'
import conversationHandler from './api/conversation.js'
import ideasHandler from './api/ideas.js'
import ephemeralChatHandler from './api/ephemeral-chat.js'
import { serveNodeRequest } from './server/http.js'

const distDir = fileURLToPath(new URL('./dist', import.meta.url))
const port = Number(process.env.PORT) || 3000

const apiRoutes = new Map([
  ['/api/chat', chatHandler],
  ['/api/contact', contactHandler],
  ['/api/conversations', conversationsHandler],
  ['/api/conversation', conversationHandler],
  ['/api/ideas', ideasHandler],
  ['/api/ephemeral-chat', ephemeralChatHandler],
])

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

async function serveStatic(req, res) {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  const file = normalize(resolve(distDir, `.${pathname}`))
  const distPrefix = distDir.endsWith(sep) ? distDir : `${distDir}${sep}`
  if (file !== distDir && !file.startsWith(distPrefix)) {
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
  let pathname
  try {
    pathname = new URL(req.url, 'http://localhost').pathname
  } catch {
    res.writeHead(400)
    res.end('Bad Request')
    return
  }

  const apiHandler = apiRoutes.get(pathname)
  if (apiHandler) {
    await serveNodeRequest(apiHandler, req, res)
    return
  }

  if (pathname.startsWith('/api/')) {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: 'not_found', message: 'Not found.' }))
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
