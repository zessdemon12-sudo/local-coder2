import { create } from 'zustand'

export type ModelBackend = 'openai' | 'openrouter' | 'llama'

export interface ModelConfig {
  backend: ModelBackend
  apiUrl?: string
  apiKey?: string
  modelName?: string
  modelPath?: string
  contextSize: number
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>
  toolResults?: Array<{ name: string; success: boolean; data?: unknown; error?: string }>
}

interface AppState {
  messages: ChatMessage[]
  streamingContent: string
  isStreaming: boolean
  isProcessing: boolean
  modelConfig: ModelConfig | null
  modelLoaded: boolean
  showSettings: boolean
  addMessage: (msg: ChatMessage) => void
  setStreamingContent: (v: string) => void
  appendStreamingContent: (v: string) => void
  setIsStreaming: (v: boolean) => void
  setIsProcessing: (v: boolean) => void
  setModelConfig: (c: ModelConfig | null) => void
  setModelLoaded: (v: boolean) => void
  setShowSettings: (v: boolean) => void
  reset: () => void
}

export const useAppStore = create<AppState>((set) => ({
  messages: [],
  streamingContent: '',
  isStreaming: false,
  isProcessing: false,
  modelConfig: null,
  modelLoaded: false,
  showSettings: false,

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setStreamingContent: (v) => set({ streamingContent: v }),
  appendStreamingContent: (token) => set((s) => ({ streamingContent: s.streamingContent + token })),
  setIsStreaming: (v) => set({ isStreaming: v }),
  setIsProcessing: (v) => set({ isProcessing: v }),
  setModelConfig: (c) => set({ modelConfig: c }),
  setModelLoaded: (v) => set({ modelLoaded: v }),
  setShowSettings: (v) => set({ showSettings: v }),
  reset: () => set({
    messages: [],
    streamingContent: '',
    isStreaming: false,
    isProcessing: false
  })
}))
