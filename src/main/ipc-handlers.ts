import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdtempSync, rmdirSync } from 'fs'
import { tmpdir, networkInterfaces } from 'os'
import { join } from 'path'
import { exec as execCb } from 'child_process'
import { promisify } from 'util'
import { ModelEngine, ModelConfig } from './model-engine'
import { AgentLoop, AgentEvent } from './agent-loop'
import { mcpManager, McpServerConfig } from './mcp-manager'
import { TtsEngine } from './tts-engine'
import { SttEngine } from './stt-engine'

const exec = promisify(execCb)

const FIREWALL_RULE_NAME = 'Local Coder - llama-server'

async function manageFirewallRule(enable: boolean): Promise<void> {
  try {
    if (enable) {
      const p = require('path')
      const resourcesPath = (process as any).resourcesPath || p.join(__dirname, '..', '..', '..')
      const serverPath = p.join(resourcesPath, 'bin', 'llama', 'llama-server.exe')
      if (!existsSync(serverPath)) return
      await exec(
        `netsh advfirewall firewall add rule name="${FIREWALL_RULE_NAME}" ` +
        `dir=in action=allow program="${serverPath}" protocol=tcp localport=8090 profile=any`
      )
    } else {
      await exec(`netsh advfirewall firewall delete rule name="${FIREWALL_RULE_NAME}"`)
    }
  } catch { }
}

let engine: ModelEngine | null = null
let agent: AgentLoop | null = null
let currentWindow: BrowserWindow | null = null
let ttsEngine: TtsEngine | null = null
let sttEngine: SttEngine | null = null

export function registerIpcHandlers(): void {

  ipcMain.handle('select-model-file', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select GGUF Model File',
      filters: [{ name: 'GGUF Models', extensions: ['gguf'] }],
      properties: ['openFile']
    })
    if (result.canceled) return null
    return result.filePaths[0]
  })

  ipcMain.handle('select-mmproj-file', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Multimodal Projector (mmproj) File',
      filters: [{ name: 'MMPROJ Files', extensions: ['gguf'] }],
      properties: ['openFile']
    })
    if (result.canceled) return null
    return result.filePaths[0]
  })

  ipcMain.handle('select-workspace', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Workspace Directory',
      properties: ['openDirectory']
    })
    if (result.canceled) return null
    return result.filePaths[0]
  })

  ipcMain.handle('init-model', async (_event, config: ModelConfig) => {
    try {
      engine?.dispose()
      engine = new ModelEngine(config)
      await engine.initialize()
      return { success: true, config: engine.getConfig() }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('chat-send', async (_event, data: { text: string; systemPrompt?: string; workspaceDir?: string | null; images?: Array<{ mimeType: string; base64: string }>; documents?: Array<{ name: string; content: string; language?: string }> }) => {
    if (!engine) return { success: false, error: 'Model not initialized' }

    currentWindow = BrowserWindow.getFocusedWindow()

    if (agent) {
      agent.stop()
    }

    const mcpTools = mcpManager.getAllTools()
    agent = new AgentLoop(engine, mcpTools, (event: AgentEvent) => {
      currentWindow?.webContents.send('agent-event', event)
    })
    if (data.systemPrompt) {
      agent.setSystemPrompt(data.systemPrompt)
    }
    if (data.workspaceDir) {
      agent.setWorkspaceDir(data.workspaceDir)
    }

    agent.start(data).catch(err => {
      currentWindow?.webContents.send('agent-event', { type: 'error', data: String(err) })
    })

    return { success: true }
  })

  ipcMain.handle('chat-stop', () => {
    agent?.stop()
    return { success: true }
  })

  ipcMain.handle('chat-reset', () => {
    agent?.reset()
    return { success: true }
  })

  ipcMain.handle('update-workspace-dir', async (_event, dir: string | null) => {
    if (agent) agent.setWorkspaceDir(dir || '')
    return { success: true }
  })

  ipcMain.handle('model-disconnect', () => {
    agent?.reset()
    engine?.dispose()
    engine = null
    agent = null
    return { success: true }
  })

  ipcMain.handle('approve-tool', async (_event, approved: boolean) => {
    agent?.approveCurrent(approved)
    return { success: true }
  })

  ipcMain.handle('update-api-url', async (_event, url: string) => {
    if (!engine) return { success: false, error: 'Model not initialized' }
    const config = engine.getConfig()
    config.apiUrl = url
    return { success: true }
  })

  ipcMain.handle('toggle-local-network', async () => {
    if (!engine) return { success: false, error: 'Model not initialized' }
    const config = engine.getConfig()
    const newValue = !config.localNetwork
    config.localNetwork = newValue
    try {
      await manageFirewallRule(newValue)
      await engine.dispose()
      engine = new ModelEngine(config)
      await engine.initialize()
      return { success: true, config: engine.getConfig() }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('get-local-ip', () => {
    const nets = networkInterfaces()
    const candidates: string[] = []
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          candidates.push(net.address)
        }
      }
    }
    // Prefer real network over virtual adapters (VirtualBox, VMware, etc.)
    const real = candidates.find(ip =>
      !ip.startsWith('192.168.56.') &&
      !ip.startsWith('192.168.99.') &&
      !ip.startsWith('10.0.2.')
    )
    return real || candidates[0] || '127.0.0.1'
  })

  ipcMain.handle('open-external', async (_event, url: string) => {
    await shell.openExternal(url)
  })

  ipcMain.handle('fetch-models', async (_event, apiUrl: string, apiKey?: string) => {
    try {
      const baseUrl = apiUrl || 'http://127.0.0.1:11434'
      const url = `${baseUrl}/models`
      const headers: Record<string, string> = {}
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
      const res = await fetch(url, { headers })
      if (!res.ok) return { success: false, error: `HTTP ${res.status}` }
      const data = await res.json()
      const models: string[] = (data.data || data.models || []).map((m: any) => m.id || m.name || m.model)
      return { success: true, models }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('tts-synthesize', async (_event, data: { text: string; modelPath?: string; vocoderPath?: string; backend?: string }) => {
    try {
      if (data.backend === 'edge-tts') {
        const tmpDir = mkdtempSync(join(tmpdir(), 'tts-'))
        const textFile = join(tmpDir, 'text.txt')
        const outFile = join(tmpDir, 'out.wav')
        writeFileSync(textFile, data.text, 'utf-8')
        const cmd = `edge-tts --file "${textFile}" --voice en-US-JennyNeural --write-media "${outFile}"`
        await exec(cmd, { timeout: 60000 })
        const wav = readFileSync(outFile)
        const base64 = wav.toString('base64')
        try { unlinkSync(textFile); unlinkSync(outFile); rmdirSync(tmpDir) } catch {}
        return { success: true, audio: base64 }
      }

      if (!data.modelPath || !data.modelPath.trim()) throw new Error(`TTS model path is empty (received: "${data.modelPath}")`)
      if (!existsSync(data.modelPath)) throw new Error(`TTS model file not found: ${data.modelPath}`)
      ttsEngine?.stop()
      ttsEngine = new TtsEngine({ modelPath: data.modelPath, vocoderPath: data.vocoderPath })
      const audio = await ttsEngine.synthesize(data.text)
      return { success: true, audio }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('tts-stop', async () => {
    ttsEngine?.stop()
    ttsEngine = null
    return { success: true }
  })

  // --- STT handlers ---

  ipcMain.handle('stt-transcribe', async (_event, data: { audioBase64: string }) => {
    try {
      if (!sttEngine) sttEngine = new SttEngine('tiny')
      const text = await sttEngine.transcribe(data.audioBase64)
      return { success: true, text }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('stt-stop', async () => {
    sttEngine?.stop()
    sttEngine = null
    return { success: true }
  })

  // --- MCP client handlers ---

  ipcMain.handle('mcp-add-server', async (_event, config: McpServerConfig) => {
    try {
      await mcpManager.addServer(config)
      return { success: true, servers: mcpManager.getServers() }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('mcp-remove-server', async (_event, id: string) => {
    await mcpManager.removeServer(id)
    return { success: true, servers: mcpManager.getServers() }
  })

  ipcMain.handle('mcp-get-servers', async () => {
    return { success: true, servers: mcpManager.getServers() }
  })

  ipcMain.handle('mcp-get-tools', async () => {
    return { success: true, tools: mcpManager.getAllTools() }
  })
}
