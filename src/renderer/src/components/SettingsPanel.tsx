import { useState, useEffect } from 'react'
import { useAppStore } from '../store/chat-store'
import { ModelDownloaderView } from './ModelDownloader'

interface McpServerInfo {
  id: string
  name: string
  command: string
  args: string[]
}

interface SettingsPanelProps {
  onClose: () => void
}

function McpConfig() {
  const [servers, setServers] = useState<McpServerInfo[]>([])
  const [name, setName] = useState('')
  const [cmd, setCmd] = useState('')
  const [args, setArgs] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const api = (window as any).electronApi
      const res = await api.mcpGetServers()
      if (res.success) setServers(res.servers || [])
    } catch { }
  }

  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    if (!name.trim() || !cmd.trim()) return
    setError('')
    setAdding(true)
    try {
      const api = (window as any).electronApi
      const id = 'mcp-' + Date.now()
      const argsList = args.trim() ? args.split(' ').filter(Boolean) : []
      const res = await api.mcpAddServer({ id, name: name.trim(), command: cmd.trim(), args: argsList })
      if (res.success) {
        setServers(res.servers || [])
        setName('')
        setCmd('')
        setArgs('')
      } else {
        setError(res.error || 'Failed to connect')
      }
    } catch (err) {
      setError(String(err))
    }
    setAdding(false)
  }

  const handleRemove = async (id: string) => {
    try {
      const api = (window as any).electronApi
      const res = await api.mcpRemoveServer(id)
      if (res.success) setServers(res.servers || [])
    } catch { }
  }

  return (
    <div>
      <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
        MCP Servers
      </h3>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
        Connect MCP servers to give the agent additional tools like filesystem access, web search, databases, etc.
      </p>

      {servers.map(s => (
        <div key={s.id} style={{
          padding: '8px 10px',
          marginBottom: 6,
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.command} {s.args.join(' ')}</div>
          </div>
          <button onClick={() => handleRemove(s.id)}
            style={{
              background: 'none', border: 'none', color: 'var(--danger)',
              fontSize: 12, cursor: 'pointer', padding: '2px 6px'
            }}>Remove</button>
        </div>
      ))}

      <div style={{
        marginTop: 12, padding: 12, borderRadius: 'var(--radius)',
        border: '1px solid var(--border)', background: 'var(--bg-tertiary)'
      }}>
        <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Add MCP Server</div>

        <input placeholder="Server name (e.g. Filesystem)"
          value={name} onChange={e => setName(e.target.value)}
          style={inputStyle} />

        <input placeholder="Command (e.g. npx)"
          value={cmd} onChange={e => setCmd(e.target.value)}
          style={inputStyle} />

        <input placeholder="Arguments (e.g. -y @modelcontextprotocol/server-filesystem C:\workspace)"
          value={args} onChange={e => setArgs(e.target.value)}
          style={inputStyle} />

        {error && <div style={{ fontSize: 11, color: 'var(--danger)', marginBottom: 6 }}>{error}</div>}

        <button onClick={handleAdd} disabled={adding || !name.trim() || !cmd.trim()}
          style={{
            padding: '6px 14px', borderRadius: 'var(--radius)',
            border: 'none', background: 'var(--accent)', color: '#fff',
            fontSize: 12, cursor: adding ? 'wait' : 'pointer',
            opacity: adding ? 0.6 : 1
          }}>
          {adding ? 'Connecting...' : 'Connect'}
        </button>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', marginBottom: 6, padding: '6px 10px',
  borderRadius: 'var(--radius)', border: '1px solid var(--border)',
  background: 'var(--bg-secondary)', color: 'var(--text-primary)',
  fontSize: 12, outline: 'none', boxSizing: 'border-box'
}

const buttonStyle: React.CSSProperties = {
  padding: '6px 14px', borderRadius: 'var(--radius)',
  border: '1px solid var(--accent)',
  background: 'transparent', color: 'var(--accent)',
  fontSize: 12, cursor: 'pointer'
}

const buttonStyleAlt: React.CSSProperties = {
  padding: '6px 14px', borderRadius: 'var(--radius)',
  border: '1px solid var(--border)',
  background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
  fontSize: 12, cursor: 'pointer'
}

function TtsConfig() {
  const tts = useAppStore(s => s.tts)
  const setTtsState = useAppStore(s => s.setTtsState)
  const [status, setStatus] = useState<string>('idle')
  const [errorMsg, setErrorMsg] = useState<string>('')

  const handleSelectModel = async () => {
    const api = (window as any).electronApi
    const path = await api.selectModelFile()
    if (path) { setTtsState({ modelPath: path }); setErrorMsg('') }
  }

  const handleSelectVocoder = async () => {
    const api = (window as any).electronApi
    const path = await api.selectModelFile()
    if (path) { setTtsState({ vocoderPath: path }); setErrorMsg('') }
  }

  const handleTest = async () => {
    if (!tts.modelPath) return
    setStatus('speaking')
    setErrorMsg('')
    try {
      const api = (window as any).electronApi
      const res = await api.ttsSynthesize('Hello, this is a test of the text to speech system.', tts.modelPath, tts.vocoderPath || undefined)
      if (res.success && res.audio) {
        const audio = new Audio(`data:audio/wav;base64,${res.audio}`)
        audio.onended = () => setStatus('idle')
        audio.onerror = () => { setStatus('error'); setErrorMsg('Failed to play audio') }
        await audio.play()
      } else {
        setStatus('error')
        setErrorMsg(res.error || 'Synthesis returned no audio')
      }
    } catch (err) {
      setStatus('error')
      setErrorMsg(String(err))
    }
  }

  const statusColor = status === 'speaking' ? 'var(--accent)'
    : status === 'error' ? 'var(--danger)'
    : tts.modelPath ? 'var(--success)' : 'var(--text-muted)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
          Text-to-Speech
        </h3>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
          Uses bundled llama-tts.exe with a user-provided TTS GGUF model.
          Select your model file below — no auto-download.
        </p>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 6,
          border: '1px solid var(--border)', background: 'var(--bg-tertiary)',
          fontSize: 12, marginBottom: 12
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
          <span>TTS: {status}</span>
          {tts.modelPath && <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>
            ({tts.modelPath.split('\\').pop()})
          </span>}
        </div>
        {errorMsg && (
          <div style={{
            fontSize: 11, color: 'var(--danger)', marginBottom: 8,
            padding: '6px 10px', borderRadius: 6,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            wordBreak: 'break-all', fontFamily: 'var(--font-mono)'
          }}>
            {errorMsg}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button onClick={handleSelectModel} style={buttonStyle}>
            {tts.modelPath ? 'Change TTS Model' : 'Select TTS GGUF Model'}
          </button>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handleSelectVocoder} style={buttonStyleAlt}>
              {tts.vocoderPath ? 'Change Vocoder' : 'Select Vocoder GGUF (optional)'}
            </button>
            {tts.vocoderPath && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center' }}>
                {tts.vocoderPath.split('\\').pop()}
              </span>
            )}
          </div>
          <button onClick={handleTest} disabled={!tts.modelPath || status === 'speaking'}
            style={{
              ...buttonStyle,
              opacity: !tts.modelPath || status === 'speaking' ? 0.5 : 1,
              cursor: !tts.modelPath || status === 'speaking' ? 'not-allowed' : 'pointer',
              background: 'var(--accent)', color: '#fff', border: 'none'
            }}>
            {status === 'speaking' ? 'Playing...' : 'Test TTS'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [tab, setTab] = useState<'general' | 'models' | 'mcp' | 'tts'>('general')
  const modelStatus = useAppStore(s => s.modelStatus)
  const setModelStatus = useAppStore(s => s.setModelStatus)
  const editorPreference = useAppStore(s => s.editorPreference)
  const setEditorPreference = useAppStore(s => s.setEditorPreference)
  const [apiUrlInput, setApiUrlInput] = useState(modelStatus.config?.apiUrl || '')
  const [apiUrlSaved, setApiUrlSaved] = useState(false)
  const [networkToggling, setNetworkToggling] = useState(false)
  const [localIp, setLocalIp] = useState('')

  useEffect(() => {
    if (modelStatus.config?.localNetwork) {
      (window as any).electronApi?.getLocalIp().then(setLocalIp)
    }
  }, [modelStatus.config?.localNetwork])

  const handleDisconnect = () => {
    const api = (window as any).electronApi
    api?.chatReset()
    setModelStatus({ loaded: false, loading: false, error: null, config: null })
    onClose()
  }

  const handleSaveApiUrl = async () => {
    const api = (window as any).electronApi
    const res = await api.updateApiUrl(apiUrlInput)
    if (res.success) {
      setModelStatus({ config: { ...modelStatus.config!, apiUrl: apiUrlInput } })
      setApiUrlSaved(true)
      setTimeout(() => setApiUrlSaved(false), 2000)
    }
  }

  return (
    <div style={{
      width: 400,
      minWidth: 400,
      height: '100vh',
      background: 'var(--bg-secondary)',
      borderLeft: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>Settings</span>
        <button onClick={onClose} style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          fontSize: 18,
          padding: '2px 6px',
          cursor: 'pointer'
        }}>&times;</button>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {(['general', 'models', 'mcp', 'tts'] as const).map(t => (
          <button key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '8px',
              background: tab === t ? 'var(--bg-hover)' : 'transparent',
              border: 'none',
              borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab === t ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 500,
              textTransform: 'capitalize'
            }}
          >
            {t === 'mcp' ? 'MCP' : t === 'tts' ? 'TTS' : t}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {tab === 'general' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                Model
              </h3>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                <span style={{ color: 'var(--text-muted)' }}>Backend: </span>
                {modelStatus.config?.backend || 'none'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                <span style={{ color: 'var(--text-muted)' }}>API URL: </span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  value={apiUrlInput}
                  onChange={e => { setApiUrlInput(e.target.value); setApiUrlSaved(false) }}
                  style={{
                    flex: 1,
                    padding: '5px 8px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    fontSize: 12,
                    outline: 'none',
                    fontFamily: 'var(--font-mono)'
                  }}
                />
                <button onClick={handleSaveApiUrl}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--accent)',
                    background: apiUrlSaved ? 'rgba(52,211,153,0.15)' : 'transparent',
                    color: apiUrlSaved ? '#34d399' : 'var(--accent)',
                    fontSize: 12,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}>
                  {apiUrlSaved ? 'Saved' : 'Apply'}
                </button>
              </div>
              {modelStatus.config?.backend === 'llama-server' && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Model: </span>
                  {modelStatus.config.modelPath?.split('\\').pop() || 'N/A'}
                </div>
              )}
              {modelStatus.config?.apiKey && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-muted)' }}>API Key: </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    {modelStatus.config.apiKey.slice(0, 8)}...
                  </span>
                </div>
              )}
              <button onClick={handleDisconnect} style={{
                marginTop: 8,
                padding: '6px 14px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--danger)',
                background: 'transparent',
                color: 'var(--danger)',
                fontSize: 12,
                cursor: 'pointer'
              }}>
                Disconnect & Switch Model
              </button>
            </div>
            {modelStatus.config?.backend === 'llama-server' && (
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                  Network
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={async () => {
                      setNetworkToggling(true)
                      try {
                        const api = (window as any).electronApi
                        const res = await api.toggleLocalNetwork()
                        if (res.success) {
                          setModelStatus({ config: res.config })
                          if (res.config?.localNetwork) {
                            const ip = await api.getLocalIp()
                            setLocalIp(ip)
                          } else {
                            setLocalIp('')
                          }
                        }
                      } finally {
                        setNetworkToggling(false)
                      }
                    }}
                    disabled={networkToggling}
                    style={{
                      width: 40, height: 22, borderRadius: 11,
                      border: modelStatus.config?.localNetwork ? '1px solid var(--success)' : '1px solid var(--border)',
                      background: modelStatus.config?.localNetwork ? 'var(--success)' : 'var(--bg-tertiary)',
                      cursor: networkToggling ? 'wait' : 'pointer', position: 'relative',
                      transition: 'background 0.2s'
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: 2, width: 16, height: 16,
                      borderRadius: '50%', background: '#fff',
                      left: modelStatus.config?.localNetwork ? 22 : 2, transition: 'left 0.2s'
                    }} />
                  </button>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Serve on local network
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {networkToggling
                    ? 'Restarting server...'
                    : modelStatus.config?.localNetwork
                      ? `Accessible at http://${localIp || '...'}:8090`
                      : 'Only accessible from this machine'}
                </div>
              </div>
            )}
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                Code Editor
              </h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setEditorPreference('codemirror')}
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    borderRadius: 'var(--radius)',
                    border: editorPreference === 'codemirror'
                      ? '1px solid var(--accent)'
                      : '1px solid var(--border)',
                    background: editorPreference === 'codemirror'
                      ? 'rgba(99,102,241,0.1)'
                      : 'transparent',
                    color: editorPreference === 'codemirror'
                      ? 'var(--accent)'
                      : 'var(--text-secondary)',
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  CodeMirror
                </button>
                <button
                  onClick={() => setEditorPreference('monaco')}
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    borderRadius: 'var(--radius)',
                    border: editorPreference === 'monaco'
                      ? '1px solid var(--accent)'
                      : '1px solid var(--border)',
                    background: editorPreference === 'monaco'
                      ? 'rgba(99,102,241,0.1)'
                      : 'transparent',
                    color: editorPreference === 'monaco'
                      ? 'var(--accent)'
                      : 'var(--text-secondary)',
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  Monaco
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                {editorPreference === 'monaco'
                  ? 'Monaco Editor (VS Code) with diff view'
                  : 'CodeMirror 6 with syntax highlighting'}
              </div>
            </div>
          </div>
        ) : tab === 'models' ? (
          <ModelDownloaderView />
        ) : tab === 'tts' ? (
          <TtsConfig />
        ) : (
          <McpConfig />
        )}
      </div>
    </div>
  )
}
