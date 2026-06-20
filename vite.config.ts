import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function vrErrorReporter(): Plugin {
  const logFile = path.resolve(__dirname, 'vr-errors.log')

  function printAndSave(level: string, msg: string) {
    const prefix = `[VR ${level}]`
    const timestamp = new Date().toLocaleTimeString()
    const line = `${timestamp} ${prefix} ${msg}`

    if (level === 'error') {
      console.error(`\x1b[31m${line}\x1b[0m`)
    } else if (level === 'warn') {
      console.warn(`\x1b[33m${line}\x1b[0m`)
    } else {
      console.log(`\x1b[36m${line}\x1b[0m`)
    }

    fs.appendFileSync(logFile, line + '\n')
  }

  return {
    name: 'vr-error-reporter',
    configureServer(server) {
      server.hot.on('vr:log', (data: { level: string; msg: string }) => {
        printAndSave(data.level, data.msg)
      })

      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (req.url !== '/__vr_log') {
          next()
          return
        }

        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
          res.statusCode = 204
          res.end()
          return
        }

        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }

        let body = ''
        req.on('data', (chunk: Buffer) => { body += chunk.toString() })
        req.on('end', () => {
          try {
            const data = JSON.parse(body) as { level: string; msg: string }
            printAndSave(data.level, data.msg)
          } catch { /* ignore */ }
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.statusCode = 200
          res.end('ok')
        })
      })
    },
  }
}

export default defineConfig({
  base: '/',
  plugins: [react(), basicSsl(), vrErrorReporter()],
  server: {
    host: true,
    port: 5173,
  },
  resolve: {
    dedupe: ['three', 'react', 'react-dom'],
  },
})
