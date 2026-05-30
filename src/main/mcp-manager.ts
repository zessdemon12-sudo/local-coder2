import { spawn, ChildProcess } from 'child_process'

export interface McpServerConfig {
  id: string
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
}

interface McpTool {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

export class McpManager {
  private servers = new Map<string, { config: McpServerConfig; proc: ChildProcess | null; tools: McpTool[] }>()
  private messageId = 0
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>()

  async addServer(config: McpServerConfig): Promise<void> {
    if (this.servers.has(config.id)) throw new Error(`Server ${config.id} already connected`)
    const proc = spawn(config.command, config.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...config.env },
      windowsHide: true
    })

    let buffer = ''
    proc.stdout?.on('data', (chunk: Buffer) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const msg = JSON.parse(trimmed)
          if (msg.id !== undefined && this.pending.has(msg.id)) {
            clearTimeout(this.pending.get(msg.id)!.timer)
            if (msg.error) this.pending.get(msg.id)!.reject(new Error(msg.error.message || 'MCP error'))
            else this.pending.get(msg.id)!.resolve(msg.result)
            this.pending.delete(msg.id)
          }
        } catch { }
      }
    })

    proc.stderr?.on('data', (chunk: Buffer) => {
      console.error('[mcp:' + config.name + ']', chunk.toString().trim())
    })

    proc.on('exit', (code) => {
      console.error(`[mcp:${config.name}] exited with code ${code}`)
    })

    proc.on('error', (err) => {
      console.error(`[mcp:${config.name}] error:`, err.message)
    })

    this.servers.set(config.id, { config, proc, tools: [] })

    const result = await this.sendRequest(config.id, 'tools/list', {}) as { tools: McpTool[] }
    this.servers.get(config.id)!.tools = result.tools || []
  }

  async removeServer(id: string): Promise<void> {
    const entry = this.servers.get(id)
    if (!entry) return
    entry.proc?.kill()
    this.servers.delete(id)
  }

  getAllTools(): Array<{ serverId: string; tool: McpTool }> {
    const result: Array<{ serverId: string; tool: McpTool }> = []
    for (const [serverId, entry] of this.servers) {
      for (const tool of entry.tools) {
        result.push({ serverId, tool })
      }
    }
    return result
  }

  async callTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    return this.sendRequest(serverId, 'tools/call', { name: toolName, arguments: args })
  }

  getServers(): McpServerConfig[] {
    return Array.from(this.servers.values()).map(e => e.config)
  }

  getTools(serverId: string): McpTool[] {
    return this.servers.get(serverId)?.tools || []
  }

  isConnected(id: string): boolean {
    return this.servers.has(id)
  }

  disconnectAll(): void {
    for (const [id] of this.servers) {
      this.servers.get(id)?.proc?.kill()
    }
    this.servers.clear()
    for (const [, p] of this.pending) {
      clearTimeout(p.timer)
      p.reject(new Error('MCP manager disconnected'))
    }
    this.pending.clear()
  }

  private async sendRequest(serverId: string, method: string, params: unknown): Promise<unknown> {
    const entry = this.servers.get(serverId)
    if (!entry || !entry.proc?.stdin) throw new Error(`MCP server ${serverId} not connected`)

    const id = ++this.messageId
    const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`MCP request ${method} timed out`))
      }, 30000)

      this.pending.set(id, { resolve, reject, timer })
      entry.proc!.stdin!.write(msg)
    })
  }
}

export const mcpManager = new McpManager()
