export type ModelBackend = 'openai' | 'llama-server'

export interface ModelConfig {
  backend: ModelBackend
  apiUrl?: string
  apiKey?: string
  modelName?: string
  modelPath?: string
  mmprojPath?: string
  contextSize: number
  gpuLayers?: number
  localNetwork?: boolean
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  images?: Array<{ mimeType: string; base64: string }>
  documents?: Array<{ name: string; content: string; language?: string }>
}

interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

interface ModelResponse {
  content: string
  toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>
}

export function buildSystemPrompt(toolDescriptions: Array<{ name: string; description: string; parameters: Record<string, unknown> }>): string {
  return `You are a coding assistant that helps users write, edit, and manage code files. You have access to tools for reading/writing files, executing commands, and searching code.

When you need to use a tool, respond with a tool call in the function-calling format. Available tools:
${JSON.stringify(toolDescriptions.map(t => ({
  type: 'function',
  function: t
})), null, 2)}

Always explain what you're doing before and after using tools.`
}

export class ModelEngine {
  private config: ModelConfig
  private abortController: AbortController | null = null
  private serverProcess: import('child_process').ChildProcess | null = null

  constructor(config: ModelConfig) {
    this.config = config
  }

  getConfig() { return this.config }

  async initialize(): Promise<void> {
    if (this.config.backend === 'llama-server') {
      await this.startLlamaServer()
    } else {
      const url = `${this.config.apiUrl || 'http://127.0.0.1:11434'}/v1/chat/completions`
      const testResp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {})
        },
        body: JSON.stringify({
          model: this.config.modelName || 'default',
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1
        })
      })
      if (!testResp.ok) throw new Error(`API connection failed: ${testResp.status}`)
    }
  }

  private async startLlamaServer(): Promise<void> {
    const { spawn } = await import('child_process')
    const { existsSync } = await import('fs')

    if (!this.config.modelPath) throw new Error('Model path required for llama-server')
    if (!existsSync(this.config.modelPath)) throw new Error(`Model file not found: ${this.config.modelPath}`)
    if (this.config.mmprojPath && !existsSync(this.config.mmprojPath)) {
      throw new Error(`MMProj file not found: ${this.config.mmprojPath}`)
    }

    const serverPath = this.findLlamaServer()
    if (!serverPath) {
      throw new Error(
        'llama-server not found. Please install llama.cpp or use API mode with Ollama/LM Studio.\n' +
        'Download from: https://github.com/ggml-org/llama.cpp/releases'
      )
    }

    const port = 8090
    const host = this.config.localNetwork ? '0.0.0.0' : '127.0.0.1'
    const args = [
      '-m', this.config.modelPath,
      '--host', host,
      '--port', String(port),
      '-ngl', String(this.config.gpuLayers || 0),
      '-c', String(this.config.contextSize || 4096)
    ]
    if (this.config.mmprojPath) {
      args.push('--mmproj', this.config.mmprojPath)
    }

    this.serverProcess = spawn(serverPath, args, { stdio: 'pipe' })
    let stderrLog = ''
    let serverReady = false
    this.serverProcess.stderr?.on('data', (data: Buffer) => {
      const text = data.toString()
      stderrLog += text
      console.error('[llama-server]', text.trim())
      if (text.includes('server is listening on')) {
        serverReady = true
      }
    })
    this.serverProcess.on('exit', (code: number | null) => {
      console.error(`[llama-server] exited with code ${code}`)
      console.error('[llama-server] stderr:', stderrLog)
      this.serverProcess = null
    })
    this.serverProcess.on('error', (err: Error) => {
      console.error('[llama-server] spawn error:', err.message)
    })

    this.config.apiUrl = `http://127.0.0.1:${port}`
    this.config.modelName = 'default'

    for (let i = 0; i < 120; i++) {
      if (!this.serverProcess) {
        throw new Error(`llama-server exited prematurely. Stderr:\n${stderrLog}`)
      }
      if (serverReady) {
        console.log('[llama-server] health check passed (model loaded)')
        return
      }
      await new Promise(r => setTimeout(r, 500))
    }
    throw new Error(`llama-server failed to start within 60 seconds. Stderr:\n${stderrLog}`)
  }

  private findLlamaServer(): string | null {
    const p = require('path')
    const resourcesPath = (process as any).resourcesPath || p.join(__dirname, '..', '..', '..')
    const bundledPath = p.join(resourcesPath, 'bin', 'llama', 'llama-server.exe')
    const fs = require('fs') as typeof import('fs')
    if (fs.existsSync(bundledPath)) return bundledPath

    const candidates = ['llama-server.exe', 'llama-server']
    for (const cmd of candidates) {
      try {
        const result = require('child_process').execSync(`where ${cmd} 2>nul`, { encoding: 'utf-8' }) as string
        const path = result.split('\r\n')[0].trim()
        if (path) return path
      } catch { }
    }
    return null
  }

  async chat(
    messages: ChatMessage[],
    tools?: Array<{ name: string; description: string; parameters: Record<string, unknown> }>,
    onToken?: (token: string) => void
  ): Promise<ModelResponse> {
    this.abortController = new AbortController()
    const urlStr = `${this.config.apiUrl || 'http://127.0.0.1:11434'}/v1/chat/completions`
    const url = new URL(urlStr)

    const body: Record<string, unknown> = {
      model: this.config.modelName || 'default',
      messages,
      stream: true
    }

    if (tools && tools.length > 0) {
      body.tools = tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters
        }
      }))
    }

    body.messages = messages.map(m => {
      const msg = m as Record<string, unknown>
      const images = msg.images as Array<{ mimeType: string; base64: string }> | undefined
      const documents = msg.documents as Array<{ name: string; content: string; language?: string }> | undefined

      let textContent = (msg.content as string) || ''

      if (documents?.length) {
        const docBlocks = documents.map(d => {
          const langTag = d.language ? ` (${d.language})` : ''
          return `--- File: ${d.name}${langTag} ---\n${d.content}\n--- End of ${d.name} ---`
        })
        textContent = docBlocks.join('\n\n') + (textContent ? '\n\n' + textContent : '')
      }

      const hasVision = !!this.config.mmprojPath

      if (images?.length && hasVision) {
        const content: Array<Record<string, unknown>> = []
        for (const img of images) {
          content.push({
            type: 'image_url',
            image_url: { url: `data:${img.mimeType};base64,${img.base64}` }
          })
        }
        if (textContent.trim()) {
          content.push({ type: 'text', text: textContent })
        }
        return { role: msg.role, content }
      }

      if (images?.length && !hasVision) {
        const imgMd = images.map(img =>
          `![image](data:${img.mimeType};base64,${img.base64})`
        ).join('\n')
        textContent = imgMd + (textContent ? '\n\n' + textContent : '')
      }

      return { role: msg.role, content: textContent }
    })

    const bodyStr = JSON.stringify(body)
    const httpModule = url.protocol === 'https:' ? (await import('https')).default : (await import('http')).default

    return new Promise<ModelResponse>((resolve, reject) => {
      let aborted = false

      this.abortController!.signal.addEventListener('abort', () => {
        aborted = true
        req.destroy()
        reject(new Error('Request aborted by user'))
      })

      const options: import('http').RequestOptions = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
          ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {})
        },
        timeout: 120000
      }

      const req = httpModule.request(options, (res) => {
        let fullContent = ''
        const accToolCalls = new Map<number, { name: string; args: string }>()
        let buffer = ''

        if (res.statusCode && res.statusCode >= 400) {
          let errorBody = ''
          res.on('data', (chunk: Buffer) => { errorBody += chunk.toString() })
          res.on('end', () => {
            if (!aborted) reject(new Error(`API error ${res.statusCode}: ${errorBody || res.statusMessage || ''}`))
          })
          return
        }

        res.on('data', (chunk: Buffer) => {
          if (aborted) return
          buffer += chunk.toString()
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || !trimmed.startsWith('data: ')) continue
            const data = trimmed.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              const choice = parsed.choices?.[0]
              if (!choice) continue

              const delta = choice.delta

              if (delta?.content) {
                fullContent += delta.content
                onToken?.(delta.content)
              }

              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls as Array<Record<string, unknown>>) {
                  const index = (tc.index as number) ?? 0
                  if (!accToolCalls.has(index)) accToolCalls.set(index, { name: '', args: '' })
                  const acc = accToolCalls.get(index)!
                  const fn = tc.function as Record<string, unknown> | undefined
                  if (fn?.name) acc.name = String(fn.name)
                  if (fn?.arguments) acc.args += String(fn.arguments)
                }
              }
            } catch { }
          }
        })

        res.on('end', () => {
          if (!aborted) {
            if (accToolCalls.size > 0) {
              const toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> = []
              for (const [, acc] of accToolCalls) {
                let parsed: Record<string, unknown> = {}
                try { parsed = JSON.parse(acc.args) } catch { }
                toolCalls.push({ name: acc.name, arguments: parsed })
              }
              resolve({ content: fullContent, toolCalls })
            } else {
              resolve({ content: fullContent })
            }
          }
        })

        res.on('error', (err: Error) => {
          if (!aborted) reject(err)
        })
      })

      req.on('error', (err: Error) => {
        if (!aborted) reject(err)
      })

      req.on('timeout', () => {
        req.destroy()
        if (!aborted) reject(new Error('Request timed out'))
      })

      req.write(bodyStr)
      req.end()
    })
  }

  stop(): void {
    this.abortController?.abort()
  }

  async dispose(): Promise<void> {
    this.stop()
    if (this.serverProcess) {
      this.serverProcess.kill()
      this.serverProcess = null
    }
  }
}
