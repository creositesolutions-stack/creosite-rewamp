import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import handler from './api/chat.js'
import contactHandler from './api/contact.js'

async function handleApiRequest(handlerFn, req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end('Method Not Allowed')
    return
  }

  let body = ''
  req.on('data', (chunk) => { body += chunk })
  req.on('end', async () => {
    try {
      const request = new Request(`http://localhost${req.url}`, {
        method: 'POST',
        headers: req.headers,
        body,
      })
      const response = await handlerFn(request)
      res.statusCode = response.status
      response.headers.forEach((value, key) => res.setHeader(key, value))
      if (response.body) {
        const reader = response.body.getReader()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          res.write(Buffer.from(value))
        }
      }
      res.end()
    } catch (error) {
      res.statusCode = 500
      res.end(String(error))
    }
  })
}

function apiChatPlugin() {
  return {
    name: 'api-chat-dev',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '');
      Object.assign(process.env, env);

      server.middlewares.use('/api/chat', (req, res) => {
        handleApiRequest(handler, req, res)
      })

      server.middlewares.use('/api/contact', (req, res) => {
        handleApiRequest(contactHandler, req, res)
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), apiChatPlugin()],
});
