import { ModelEngine, ChatMessage } from './model-engine'
import { toolRegistry, ToolResult } from './tools/registry'

export interface AgentEvent {
  type: 'token' | 'tool_call' | 'tool_result' | 'error' | 'done'
  data?: unknown
}

export type AgentEventHandler = (event: AgentEvent) => void

const SYSTEM_PROMPT = `You are a coding assistant that helps users write, edit, and manage code files.
You have access to tools for reading/writing files, executing commands, and searching code.
Use the available functions when you need to interact with the file system or run commands.
After getting a tool result, provide your final response immediately — do not call additional tools unless more information is needed.
Always explain what you're doing before and after using tools.
IMPORTANT: Once you have all the information needed to answer the user, stop using tools and provide your final answer.`

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

  constructor(engine: ModelEngine, mcpTools: McpToolRef[], onEvent: AgentEventHandler) {
    this.engine = engine
    this.mcpTools = mcpTools
    this.onEvent = onEvent
  }

  async start(input: string | { text: string; images?: Array<{ mimeType: string; base64: string }>; documents?: Array<{ name: string; content: string; language?: string }> }): Promise<void> {
    if (this.running) return
    this.running = true

    const userText = typeof input === 'string' ? input : input.text
    const userImages = typeof input === 'string' ? undefined : input.images
    const userDocuments = typeof input === 'string' ? undefined : input.documents

    if (this.messages.length === 0) {
      this.messages.push({ role: 'system', content: SYSTEM_PROMPT })
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
            try {
              result = await localTool.execute(toolCall.arguments)
            } catch (err) {
              result = { success: false, error: String(err) }
            }
            this.onEvent({ type: 'tool_result', data: { tool: toolCall.name, result } })
            this.messages.push({
              role: 'user',
              content: `[Tool ${toolCall.name} result]: ${JSON.stringify(result)}`
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
            this.messages.push({
              role: 'user',
              content: `[MCP Tool ${toolCall.name} result]: ${JSON.stringify(mcpResult)}`
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
    this.onEvent({ type: 'done' })
  }

  stop(): void {
    this.running = false
    this.engine.stop()
  }

  reset(): void {
    this.messages = []
    this.running = false
  }
}
