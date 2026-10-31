import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import chatHandler from './api/chat.js'
import contactHandler from './api/contact.js'
import conversationsHandler from './api/conversations.js'
import conversationHandler from './api/conversation.js'
import { serveNodeRequest } from './server/http.js'

const apiRoutes = new Map([
  ['/api/chat', chatHandler],
  ['/api/contact', contactHandler],
  ['/api/conversations', conversationsHandler],
  ['/api/conversation', conversationHandler],
])

function creoApiPlugin() {
  return {
    name: 'creo-api-dev',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '')
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) process.env[key] = value
      }

      server.middlewares.use((req, res, next) => {
        let pathname
        try {
          pathname = new URL(req.url, 'http://localhost').pathname
        } catch {
          next()
          return
        }

        const handler = apiRoutes.get(pathname)
        if (!handler) {
          next()
          return
        }

        serveNodeRequest(handler, req, res).catch((error) => {
          console.error('[vite-api] Request failed:', error instanceof Error ? error.message : error)
          if (!res.headersSent) res.statusCode = 500
          if (!res.writableEnded) res.end('Internal Server Error')
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), creoApiPlugin()],
})
