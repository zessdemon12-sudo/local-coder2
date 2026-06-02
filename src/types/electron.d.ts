export {}

declare global {
  interface Window {
    electronApi: {
      selectModelFile: () => Promise<string | null>
      selectWorkspace: () => Promise<string | null>
      initModel: (config: any) => Promise<{ success: boolean; error?: string; config?: any }>
      chatSend: (data: { text: string; images?: Array<{ mimeType: string; base64: string }>; documents?: Array<{ name: string; content: string; language?: string }> }) => Promise<{ success: boolean; error?: string }>
      chatStop: () => Promise<{ success: boolean }>
      chatReset: () => Promise<{ success: boolean }>
      openExternal: (url: string) => Promise<void>
      updateApiUrl: (url: string) => Promise<{ success: boolean; error?: string }>
      toggleLocalNetwork: () => Promise<{ success: boolean; config?: any; error?: string }>
      getLocalIp: () => Promise<string>
      onAgentEvent: (callback: (event: any) => void) => () => void
      // MCP
      mcpAddServer: (config: { id: string; name: string; command: string; args: string[]; env?: Record<string, string> }) => Promise<{ success: boolean; servers?: any[]; error?: string }>
      mcpRemoveServer: (id: string) => Promise<{ success: boolean; servers?: any[] }>
      mcpGetServers: () => Promise<{ success: boolean; servers?: any[] }>
      mcpGetTools: () => Promise<{ success: boolean; tools?: any[] }>
      // TTS
      ttsSynthesize: (text: string, modelPath: string, vocoderPath?: string, backend?: string) => Promise<{ success: boolean; audio?: string; error?: string }>
      ttsStop: () => Promise<{ success: boolean }>
      // STT
      sttTranscribe: (audioBase64: string) => Promise<{ success: boolean; text?: string; error?: string }>
      sttStop: () => Promise<{ success: boolean }>
      // MCP Server (for opencode)
    }
  }
}
