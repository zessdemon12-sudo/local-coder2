import http, { IncomingMessage, ServerResponse } from 'http'
import { ModelEngine } from './model-engine'

interface SseClient {
  id: string
  res: ServerResponse
}

export class McpServerProvider {
  private engine: ModelEngine | null
  private httpServer: http.Server | null = null
  private sseClients: SseClient[] = []
  private running = false
  private messageId = 0

  constructor(engine: ModelEngine | null) {
    this.engine = engine
  }

  isRunning(): boolean {
    return this.running
  }

  async start(): Promise<void> {
    if (this.running) return

    return new Promise((resolve, reject) => {
      this.httpServer = http.createServer((req, res) => {
        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

        if (req.method === 'OPTIONS') {
          res.writeHead(200)
          res.end()
          return
        }

        const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

        if (url.pathname === '/sse') {
          this.handleSse(req, res)
        } else if (url.pathname === '/messages' && req.method === 'POST') {
          this.handleMessage(req, res)
        } else {
          res.writeHead(404)
          res.end(JSON.stringify({ error: 'Not found' }))
        }
      })

      this.httpServer.on('error', (err) => reject(err))

      this.httpServer.listen(8091, '127.0.0.1', () => {
        this.running = true
        console.log('[mcp-server] Listening on port 8091')
        resolve()
      })
    })
  }

  stop(): void {
    this.running = false
    for (const client of this.sseClients) {
      try { client.res.end() } catch {}
    }
    this.sseClients = []
    if (this.httpServer) {
      this.httpServer.close()
      this.httpServer = null
    }
    console.log('[mcp-server] Stopped')
  }

  private handleSse(req: IncomingMessage, res: ServerResponse): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    })

    const clientId = String(Date.now())
    const client: SseClient = { id: clientId, res }
    this.sseClients.push(client)

    // Send endpoint event with session ID
    res.write(`event: endpoint\ndata: /messages?session_id=${clientId}\n\n`)

    req.on('close', () => {
      this.sseClients = this.sseClients.filter(c => c.id !== clientId)
    })
  }

  private handleMessage(req: IncomingMessage, res: ServerResponse): void {
    let body = ''
    req.on('data', (chunk: Buffer) => { body += chunk.toString() })
    req.on('end', () => {
      try {
        const msg = JSON.parse(body)
        this.handleJsonRpc(msg, res)
      } catch (err) {
        res.writeHead(400)
        res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' }, id: null }))
      }
    })
  }

  private async handleJsonRpc(msg: any, res: ServerResponse): Promise<void> {
    const id = msg.id
    const method = msg.method as string

    if (method === 'tools/list') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id,
        result: {
          tools: [
            {
              name: 'chat',
              description: 'Send a message to the Local Coder LLM and get a response',
              inputSchema: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    description: 'The message to send to the LLM'
                  }
                },
                required: ['message']
              }
            }
          ]
        }
      }))
      return
    }

    if (method === 'tools/call') {
      const toolName = msg.params?.name as string
      const args = msg.params?.arguments as Record<string, unknown> || {}

      if (toolName === 'chat') {
        try {
          if (!this.engine) {
            throw new Error('No model is loaded. Connect to a model first in Local Coder.')
          }

          const messageText = String(args.message || '')
          const result = await this.engine.chat(
            [{ role: 'user', content: messageText }],
            undefined,
            undefined
          )

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: result.content
                }
              ]
            }
          }))
        } catch (err) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            id,
            error: { code: -32603, message: String(err) }
          }))
        }
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Unknown tool: ${toolName}` }
        }))
      }
      return
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      jsonrpc: '2.0',
      id,
      result: {}
    }))
  }
}
