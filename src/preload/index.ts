import { contextBridge, ipcRenderer } from 'electron'
import type { ModelConfig } from '../main/model-engine'

interface AgentEvent {
  type: 'token' | 'tool_call' | 'tool_result' | 'error' | 'done'
  data?: unknown
}

const api = {
  selectModelFile: (): Promise<string | null> => ipcRenderer.invoke('select-model-file'),
  selectMmprojFile: (): Promise<string | null> => ipcRenderer.invoke('select-mmproj-file'),
  selectWorkspace: (): Promise<string | null> => ipcRenderer.invoke('select-workspace'),
  initModel: (config: ModelConfig) => ipcRenderer.invoke('init-model', config),
  chatSend: (data: { text: string; images?: Array<{ mimeType: string; base64: string }>; documents?: Array<{ name: string; content: string; language?: string }> }) => ipcRenderer.invoke('chat-send', data),
  chatStop: () => ipcRenderer.invoke('chat-stop'),
  chatReset: () => ipcRenderer.invoke('chat-reset'),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  updateApiUrl: (url: string) => ipcRenderer.invoke('update-api-url', url),
  toggleLocalNetwork: () => ipcRenderer.invoke('toggle-local-network'),
  getLocalIp: () => ipcRenderer.invoke('get-local-ip'),
  onAgentEvent: (callback: (event: AgentEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, e: AgentEvent) => callback(e)
    ipcRenderer.on('agent-event', handler)
    return () => ipcRenderer.removeListener('agent-event', handler)
  },
  // MCP
  mcpAddServer: (config: { id: string; name: string; command: string; args: string[]; env?: Record<string, string> }) =>
    ipcRenderer.invoke('mcp-add-server', config),
  mcpRemoveServer: (id: string) => ipcRenderer.invoke('mcp-remove-server', id),
  mcpGetServers: () => ipcRenderer.invoke('mcp-get-servers'),
  mcpGetTools: () => ipcRenderer.invoke('mcp-get-tools'),
  // TTS
  ttsSynthesize: (text: string, modelPath: string, vocoderPath?: string, backend?: string) =>
    ipcRenderer.invoke('tts-synthesize', { text, modelPath, vocoderPath, backend }),
  ttsStop: () => ipcRenderer.invoke('tts-stop'),
  // STT
  sttTranscribe: (audioBase64: string) => ipcRenderer.invoke('stt-transcribe', { audioBase64 }),
  sttStop: () => ipcRenderer.invoke('stt-stop'),
  // MCP Server (for opencode)
}

contextBridge.exposeInMainWorld('electronApi', api)
