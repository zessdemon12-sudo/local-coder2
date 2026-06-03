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
  backend: 'edge-tts' | 'llama-tts'
}

export const DEFAULT_SYSTEM_PROMPT = `You are an expert AI software engineer, systems architect, and technical assistant.

Your primary goal is to help the user complete tasks accurately, efficiently, and safely.

Core Rules:

1. Always understand the user's objective before acting.
2. Break complex tasks into clear steps.
3. Think about dependencies, edge cases, and failure points.
4. Never invent facts, APIs, functions, or files.
5. If information is missing, ask concise clarification questions.
6. Prefer practical solutions over theoretical explanations.
7. Write production-quality code whenever possible.
8. Keep code clean, documented, and maintainable.
9. Explain important decisions briefly.
10. When modifying code:
   - Preserve existing functionality.
   - Minimize unnecessary changes.
   - Show exactly what was changed.

Coding Standards:

- Follow language best practices.
- Use meaningful variable and function names.
- Handle errors properly.
- Optimize for readability first, performance second.
- Add comments only where they improve understanding.

Problem Solving:

- Analyze requirements.
- Create a plan.
- Execute step-by-step.
- Validate the result.
- Report assumptions and limitations.

Project Awareness:

- Consider project structure.
- Maintain consistency with existing code.
- Respect framework conventions.
- Identify missing files or dependencies.

Output Format:

1. Analysis
2. Plan
3. Implementation
4. Verification
5. Next Steps

Behavior:

- Be precise.
- Be concise.
- Be reliable.
- Avoid unnecessary verbosity.
- Prioritize completing the user's objective.

Never claim to have performed actions that you cannot verify.
Never pretend code has been tested when it has not.
Always distinguish facts from assumptions.`

function loadSystemPrompt(): string {
  try {
    return localStorage.getItem('local-coder-system-prompt') || DEFAULT_SYSTEM_PROMPT
  } catch { return DEFAULT_SYSTEM_PROMPT }
}

function saveSystemPrompt(prompt: string): void {
  try { localStorage.setItem('local-coder-system-prompt', prompt) } catch {}
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
  systemPrompt: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  addMessage: (msg: ChatMessage) => void
  setSystemPrompt: (prompt: string) => void
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
  setTokenCounts: (counts: { inputTokens?: number; outputTokens?: number; totalTokens?: number }) => void
  theme: 'dark' | 'light'
  fastInput: boolean
  setTheme: (theme: 'dark' | 'light') => void
  setFastInput: (v: boolean) => void
  pendingApproval: { tool: string; args: Record<string, unknown>; workspace: string } | null
  setPendingApproval: (approval: { tool: string; args: Record<string, unknown>; workspace: string } | null) => void
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
  tts: { modelPath: null, vocoderPath: null, speaking: false, speakingMessageIndex: null, backend: 'edge-tts' },
  systemPrompt: loadSystemPrompt(),
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  pendingApproval: null,
  theme: 'dark',
  fastInput: false,

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setSystemPrompt: (prompt) => { saveSystemPrompt(prompt); set({ systemPrompt: prompt }) },
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
  setTokenCounts: (counts) => set((s) => ({
    inputTokens: counts.inputTokens ?? s.inputTokens,
    outputTokens: counts.outputTokens ?? s.outputTokens,
    totalTokens: counts.totalTokens ?? s.totalTokens
  })),
  setPendingApproval: (approval) => set({ pendingApproval: approval }),
  setTheme: (theme) => set({ theme }),
  setFastInput: (v) => set({ fastInput: v }),
  reset: () => set({
    messages: [],
    streamingContent: '',
    isStreaming: false,
    isProcessing: false,
    tts: { modelPath: null, vocoderPath: null, speaking: false, speakingMessageIndex: null, backend: 'edge-tts' },
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0
  })
}))
