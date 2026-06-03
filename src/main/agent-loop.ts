import { ModelEngine, ChatMessage } from './model-engine'
import { toolRegistry, ToolResult, setCurrentWorkspaceDir } from './tools/registry'

export interface AgentEvent {
  type: 'token' | 'tool_call' | 'tool_result' | 'tool_approval' | 'error' | 'done'
  data?: unknown
}

export type AgentEventHandler = (event: AgentEvent) => void

const MAX_SUBAGENT_DEPTH = 5
let currentDepth = 0

function relativizeResult(content: string, workspaceDir: string): string {
  if (!workspaceDir) return content
  const sep = workspaceDir.endsWith('/') || workspaceDir.endsWith('\\') ? '' : '\\'
  const escaped = workspaceDir.replace(/[/\\]/g, m => m === '\\' ? '\\\\' : '\\/')
  // replace absolute paths with workspace-relative
  return content.replace(new RegExp(escaped + '[\\\\/]', 'gi'), './')
}

interface McpToolRef {
  serverId: string
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

export class AgentLoop {
  private engine: ModelEngine
  private messages: ChatMessage[] = []
  private onEvent: AgentEventHandler
  private running = false
  private maxIterations = 20
  private mcpTools: McpToolRef[] = []

  private systemPromptOverride = ''
  private systemPromptInjected = false
  private workspaceDir = ''
  private workspaceInjected = false

  private pendingApproval: { resolve: (approved: boolean) => void } | null = null

  approveCurrent(approved: boolean): void {
    if (this.pendingApproval) {
      this.pendingApproval.resolve(approved)
      this.pendingApproval = null
    }
  }

  constructor(engine: ModelEngine, mcpTools: McpToolRef[], onEvent: AgentEventHandler) {
    this.engine = engine
    this.mcpTools = mcpTools
    this.onEvent = onEvent
  }

  setSystemPrompt(prompt: string): void {
    this.systemPromptOverride = prompt
    this.systemPromptInjected = false
  }

  setWorkspaceDir(dir: string): void {
    this.workspaceDir = dir
    this.workspaceInjected = false
    setCurrentWorkspaceDir(dir)
  }

  async start(input: string | { text: string; images?: Array<{ mimeType: string; base64: string }>; documents?: Array<{ name: string; content: string; language?: string }> }): Promise<void> {
    if (this.running) return
    if (currentDepth >= MAX_SUBAGENT_DEPTH) {
      this.onEvent({ type: 'error', data: 'Max subagent recursion depth reached' })
      this.onEvent({ type: 'done' })
      return
    }
    currentDepth++
    this.running = true

    const userText = typeof input === 'string' ? input : input.text
    const userImages = typeof input === 'string' ? undefined : input.images
    const userDocuments = typeof input === 'string' ? undefined : input.documents

    if (this.messages.length === 0) {
      if (this.systemPromptOverride) {
        this.messages.push({ role: 'system', content: this.systemPromptOverride })
        this.systemPromptInjected = true
      } else {
        this.messages.push({ role: 'system', content: 'You are an AI assistant with access to tools.' })
      }
    }
    if (this.workspaceDir && !this.workspaceInjected) {
      const toolNames = toolRegistry.map(t => t.name).sort().join(', ')
      this.messages.push({ role: 'system', content: `The user's workspace directory is: ${this.workspaceDir}. Use this as the base path for file operations. Available tools: ${toolNames}.` })
      this.workspaceInjected = true
    }
    const userMsg: ChatMessage = { role: 'user', content: userText }
    if (userImages?.length) userMsg.images = userImages
    if (userDocuments?.length) userMsg.documents = userDocuments
    this.messages.push(userMsg)

    const allTools = [
      ...toolRegistry.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters
      })),
      ...this.mcpTools.map(t => ({
        name: `${t.serverId}__${t.name}`,
        description: t.description || '',
        parameters: (t.inputSchema || { type: 'object', properties: {} }) as Record<string, unknown>
      }))
    ]

    let iteration = 0
    let toolOnlyIterations = 0
    let lastToolCount = 0
    while (this.running && iteration < this.maxIterations) {
      iteration++

      let fullContent = ''
      const response = await this.engine.chat(
        this.messages,
        allTools,
        (token) => {
          fullContent += token
          this.onEvent({ type: 'token', data: token })
        }
      )

      if (response.toolCalls && response.toolCalls.length > 0) {
        if (response.content) {
          this.messages.push({ role: 'assistant', content: response.content })
        }

        // Detect tool-only loops: if no text content for 3 consecutive iterations, stop
        if (!response.content || response.content.trim().length < 20) {
          toolOnlyIterations++
        } else {
          toolOnlyIterations = 0
        }

        if (toolOnlyIterations >= 3 && response.toolCalls.length === lastToolCount) {
          this.onEvent({ type: 'token', data: '\n\n[Auto-completing: tool loop detected]' })
          break
        }
        lastToolCount = response.toolCalls.length

        for (const toolCall of response.toolCalls) {
          this.onEvent({ type: 'tool_call', data: toolCall })

          const localTool = toolRegistry.find(t => t.name === toolCall.name)
          if (localTool) {
            let result: ToolResult
            if ((toolCall.name === 'write_file' || toolCall.name === 'edit_file') && this.workspaceDir) {
              this.onEvent({
                type: 'tool_approval',
                data: { tool: toolCall.name, args: toolCall.arguments, workspace: this.workspaceDir }
              })
              const approved = await new Promise<boolean>((resolve) => {
                this.pendingApproval = { resolve }
              })
              if (!approved) {
                result = { success: false, error: 'User rejected tool execution' }
                this.messages.push({
                  role: 'user',
                  content: `[Tool ${toolCall.name} rejected by user]`
                })
                continue
              }
            }
            try {
              result = await localTool.execute(toolCall.arguments)
            } catch (err) {
              result = { success: false, error: String(err) }
            }
            this.onEvent({ type: 'tool_result', data: { tool: toolCall.name, result } })
            const resultStr = JSON.stringify(result)
            this.messages.push({
              role: 'user',
              content: `[Tool ${toolCall.name} result]: ${relativizeResult(resultStr, this.workspaceDir)}`
            })
            continue
          }

          const mcpTool = this.mcpTools.find(t => `${t.serverId}__${t.name}` === toolCall.name)
          if (mcpTool) {
            const { mcpManager } = await import('./mcp-manager')
            let mcpResult: unknown
            try {
              mcpResult = await mcpManager.callTool(mcpTool.serverId, mcpTool.name, toolCall.arguments)
            } catch (err) {
              mcpResult = { success: false, error: String(err) }
            }
            this.onEvent({ type: 'tool_result', data: { tool: toolCall.name, result: mcpResult } })
            const mcpStr = JSON.stringify(mcpResult)
            this.messages.push({
              role: 'user',
              content: `[MCP Tool ${toolCall.name} result]: ${relativizeResult(mcpStr, this.workspaceDir)}`
            })
            continue
          }

          this.onEvent({ type: 'error', data: `Unknown tool: ${toolCall.name}` })
        }
      } else {
        this.messages.push({ role: 'assistant', content: fullContent })
        break
      }
    }

    this.running = false
    currentDepth = Math.max(0, currentDepth - 1)
    this.onEvent({ type: 'done' })
  }

  stop(): void {
    this.running = false
    currentDepth = Math.max(0, currentDepth - 1)
    this.engine.stop()
  }

  reset(): void {
    this.messages = []
    this.running = false
    this.systemPromptInjected = false
    this.workspaceInjected = false
  }
}
