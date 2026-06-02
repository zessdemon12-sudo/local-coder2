import { NativeModules, Platform } from 'react-native'
import type { ModelConfig, ChatMessage } from '../store/chat-store'

const { LlamaModule } = NativeModules

interface StreamCallbacks {
  onToken: (token: string) => void
  onDone: (content: string) => void
  onError: (error: string) => void
}

interface LlamaResponse {
  content: string
  toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>
}

let abortController: AbortController | null = null

function buildOpenAIBody(messages: ChatMessage[], modelName: string, stream: boolean) {
  return {
    model: modelName,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content
    })),
    stream,
    max_tokens: 4096
  }
}

async function openAIChat(
  config: ModelConfig,
  messages: ChatMessage[],
  callbacks: StreamCallbacks
): Promise<LlamaResponse> {
  abortController = new AbortController()
  const url = `${config.apiUrl || 'https://openrouter.ai/api/v1'}/chat/completions`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {})
  }
  if (config.backend === 'openrouter') {
    headers['HTTP-Referer'] = 'https://local-coder.app'
    headers['X-Title'] = 'Local Coder'
  }

  const body = buildOpenAIBody(messages, config.modelName || 'default', true)

  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: abortController.signal
  })

  if (!resp.ok) {
    const errText = await resp.text()
    throw new Error(`API error ${resp.status}: ${errText}`)
  }

  const reader = resp.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''
  let fullContent = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data: ')) continue
      const data = trimmed.slice(6)
      if (data === '[DONE]') continue

      try {
        const parsed = JSON.parse(data)
        const content = parsed.choices?.[0]?.delta?.content || ''
        if (content) {
          fullContent += content
          callbacks.onToken(content)
        }
      } catch { }
    }
  }

  callbacks.onDone(fullContent)
  return { content: fullContent }
}

async function llamaNativeChat(
  config: ModelConfig,
  messages: ChatMessage[],
  callbacks: StreamCallbacks
): Promise<LlamaResponse> {
  if (!LlamaModule) throw new Error('Llama native module not available')

  const prompt = messages.map(m => {
    const role = m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user'
    return `<|im_start|>${role}\n${m.content}<|im_end|>`
  }).join('\n') + '\n<|im_start|>assistant\n'

  await LlamaModule.loadModel(config.modelPath || '', config.contextSize || 4096)

  let fullContent = ''
  await LlamaModule.generate(prompt, (token: string) => {
    fullContent += token
    callbacks.onToken(token)
  })

  callbacks.onDone(fullContent)
  return { content: fullContent }
}

export const llmApi = {
  async chat(
    config: ModelConfig,
    messages: ChatMessage[],
    callbacks: StreamCallbacks
  ): Promise<LlamaResponse> {
    if (config.backend === 'llama' && Platform.OS === 'android') {
      return llamaNativeChat(config, messages, callbacks)
    }
    return openAIChat(config, messages, callbacks)
  },

  async testConnection(config: ModelConfig): Promise<boolean> {
    if (config.backend === 'llama') {
      if (!LlamaModule) throw new Error('Llama native module not available')
      return true
    }

    const url = `${config.apiUrl || 'https://openrouter.ai/api/v1'}/chat/completions`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {})
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.modelName || 'default',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1
      })
    })
    return resp.ok
  },

  stop(): void {
    abortController?.abort()
    abortController = null
    LlamaModule?.stopGeneration()
  }
}
