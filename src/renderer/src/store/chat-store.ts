import { create } from 'zustand'
import type { ModelConfig } from '../../main/model-engine'

interface ImageAttachment {
  mimeType: string
  base64: string
}

interface DocumentAttachment {
  name: string
  content: string
  language?: string
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  images?: ImageAttachment[]
  documents?: DocumentAttachment[]
  toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>
  toolResults?: Array<{ name: string; success: boolean; data?: unknown; error?: string }>
}

interface ModelStatus {
  loaded: boolean
  loading: boolean
  error: string | null
  config: ModelConfig | null
}

interface TtsState {
  modelPath: string | null
  vocoderPath: string | null
  speaking: boolean
  speakingMessageIndex: number | null
}

interface AppState {
  messages: ChatMessage[]
  streamingContent: string
  isStreaming: boolean
  isProcessing: boolean
  modelStatus: ModelStatus
  workspaceDir: string | null
  sidebarOpen: boolean
  showSettings: boolean
  editorPreference: 'codemirror' | 'monaco'
  tts: TtsState
  addMessage: (msg: ChatMessage) => void
  setStreamingContent: (content: string) => void
  appendStreamingContent: (token: string) => void
  setIsStreaming: (v: boolean) => void
  setIsProcessing: (v: boolean) => void
  setModelStatus: (status: Partial<ModelStatus>) => void
  setWorkspaceDir: (dir: string | null) => void
  setSidebarOpen: (v: boolean) => void
  setShowSettings: (v: boolean) => void
  setEditorPreference: (pref: 'codemirror' | 'monaco') => void
  setTtsState: (state: Partial<TtsState>) => void
  reset: () => void
}

export const useAppStore = create<AppState>((set) => ({
  messages: [],
  streamingContent: '',
  isStreaming: false,
  isProcessing: false,
  modelStatus: {
    loaded: false,
    loading: false,
    error: null,
    config: null
  },
  workspaceDir: null,
  sidebarOpen: true,
  showSettings: false,
  editorPreference: 'codemirror',
  tts: { modelPath: null, vocoderPath: null, speaking: false, speakingMessageIndex: null },

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setStreamingContent: (content) => set({ streamingContent: content }),
  appendStreamingContent: (token) => set((s) => ({ streamingContent: s.streamingContent + token })),
  setIsStreaming: (v) => set({ isStreaming: v }),
  setIsProcessing: (v) => set({ isProcessing: v }),
  setModelStatus: (status) => set((s) => ({ modelStatus: { ...s.modelStatus, ...status } })),
  setWorkspaceDir: (dir) => set({ workspaceDir: dir }),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setShowSettings: (v) => set({ showSettings: v }),
  setEditorPreference: (pref) => set({ editorPreference: pref }),
  setTtsState: (state) => set((s) => ({ tts: { ...s.tts, ...state } })),
  reset: () => set({
    messages: [],
    streamingContent: '',
    isStreaming: false,
    isProcessing: false,
    tts: { modelPath: null, vocoderPath: null, speaking: false, speakingMessageIndex: null }
  })
}))
