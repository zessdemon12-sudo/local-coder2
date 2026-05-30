import { useState } from 'react'
import { useAppStore } from '../store/chat-store'

export function ModelSetup() {
  const setModelStatus = useAppStore(s => s.setModelStatus)
  const [mode, setMode] = useState<'openai' | 'llama-server'>('openai')
  const [apiUrl, setApiUrl] = useState('http://localhost:11434')
  const [apiKey, setApiKey] = useState('')
  const [modelName, setModelName] = useState('')
  const [modelPath, setModelPath] = useState('')
  const [contextSize, setContextSize] = useState(4096)
  const [gpuLayers, setGpuLayers] = useState(0)
  const [mmprojPath, setMmprojPath] = useState('')
  const [localNetwork, setLocalNetwork] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSelectFile = async () => {
    const api = (window as any).electronApi
    if (!api) return
    const file = await api.selectModelFile()
    if (file) setModelPath(file)
  }

  const handleSelectMmproj = async () => {
    const api = (window as any).electronApi
    if (!api) return
    const file = await api.selectMmprojFile()
    if (file) setMmprojPath(file)
  }

  const handleConnect = async () => {
    setLoading(true)
    setError(null)
    try {
      const api = (window as any).electronApi
      if (!api) throw new Error('Electron API not available')

      const config = mode === 'openai'
        ? { backend: 'openai', apiUrl, apiKey, modelName, contextSize }
        : { backend: 'llama-server', modelPath, mmprojPath, contextSize, gpuLayers, localNetwork }

      const result = await api.initModel(config)
      if (result.success) {
        setModelStatus({ loaded: true, loading: false, error: null, config: result.config || config })
      } else {
        setError(result.error || 'Failed to initialize model')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      width: '100vw',
      background: 'var(--bg-primary)',
      padding: 40
    }}>
      <div style={{
        maxWidth: 500,
        width: '100%',
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-lg)',
        padding: 32,
        border: '1px solid var(--border)'
      }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>Local Coder</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>
          Connect to a local LLM backend
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button
            onClick={() => setMode('openai')}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: 'var(--radius)',
              border: `1px solid ${mode === 'openai' ? 'var(--accent)' : 'var(--border)'}`,
              background: mode === 'openai' ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: '#fff',
              fontWeight: 500,
              fontSize: 14
            }}
          >
            API Server
          </button>
          <button
            onClick={() => setMode('llama-server')}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: 'var(--radius)',
              border: `1px solid ${mode === 'llama-server' ? 'var(--accent)' : 'var(--border)'}`,
              background: mode === 'llama-server' ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: '#fff',
              fontWeight: 500,
              fontSize: 14
            }}
          >
            Direct GGUF
          </button>
        </div>

        {mode === 'openai' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>API URL</label>
              <input
                type="text"
                value={apiUrl}
                onChange={e => setApiUrl(e.target.value)}
                placeholder="http://localhost:11434"
                style={inputStyle}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Supports Ollama (11434), LM Studio (1234), llama-server (8080), vLLM, etc.
              </div>
            </div>
            <div>
              <label style={labelStyle}>Model Name</label>
              <input
                type="text"
                value={modelName}
                onChange={e => setModelName(e.target.value)}
                placeholder="llama3.2, codestral, qwen2.5-coder, etc."
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>API Key (optional)</label>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="sk-..."
                style={inputStyle}
              />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>Model File (.gguf)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={modelPath}
                  onChange={e => setModelPath(e.target.value)}
                  placeholder="Path to GGUF model file..."
                  style={inputStyle}
                />
                <button onClick={handleSelectFile} style={btnSecondaryStyle}>
                  Browse
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Requires llama-server binary in PATH. Download from github.com/ggml-org/llama.cpp
              </div>
            </div>
            <div>
              <label style={labelStyle}>Context Size</label>
              <input
                type="number"
                value={contextSize}
                onChange={e => setContextSize(Number(e.target.value))}
                style={inputStyle}
                min={1024}
                max={65536}
                step={1024}
              />
            </div>
            {mode === 'llama-server' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <button
                  onClick={() => setLocalNetwork(!localNetwork)}
                  style={{
                    width: 40, height: 22, borderRadius: 11, border: localNetwork ? '1px solid var(--success)' : '1px solid var(--border)',
                    background: localNetwork ? 'var(--success)' : 'var(--bg-tertiary)',
                    cursor: 'pointer', position: 'relative', transition: 'background 0.2s'
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 2, width: 16, height: 16,
                    borderRadius: '50%', background: '#fff',
                    left: localNetwork ? 22 : 2, transition: 'left 0.2s'
                  }} />
                </button>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Serve on local network
                </span>
              </div>
            )}
            <div>
              <label style={labelStyle}>MMProj File (for vision models)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={mmprojPath}
                  onChange={e => setMmprojPath(e.target.value)}
                  placeholder="Path to mmproj GGUF file..."
                  style={inputStyle}
                />
                <button onClick={handleSelectMmproj} style={btnSecondaryStyle}>
                  Browse
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Required for multimodal/vision models (e.g. LLaVA, Qwen2-VL)
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <label style={labelStyle}>Context Size</label>
          <input
            type="number"
            value={contextSize}
            onChange={e => setContextSize(Number(e.target.value))}
            style={inputStyle}
            min={1024}
            max={65536}
            step={1024}
          />
        </div>

        {error && (
          <div style={{
            marginTop: 12,
            padding: '8px 12px',
            background: 'rgba(255,107,107,0.1)',
            border: '1px solid var(--danger)',
            borderRadius: 'var(--radius)',
            color: 'var(--danger)',
            fontSize: 13
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleConnect}
          disabled={loading || (mode === 'llama-server' && !modelPath)}
          style={{
            width: '100%',
            marginTop: 20,
            padding: '12px 24px',
            borderRadius: 'var(--radius)',
            border: 'none',
            background: loading ? 'var(--bg-hover)' : 'var(--accent)',
            color: '#fff',
            fontWeight: 600,
            fontSize: 15,
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? 'Connecting...' : 'Connect'}
        </button>

        <p style={{ marginTop: 16, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
          No cloud providers. Connect to any local LLM server or run GGUF files directly via llama.cpp.
        </p>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--text-secondary)',
  marginBottom: 4
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border)',
  background: 'var(--bg-tertiary)',
  color: 'var(--text-primary)',
  fontSize: 14,
  outline: 'none'
}

const btnSecondaryStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border)',
  background: 'var(--bg-tertiary)',
  color: 'var(--text-primary)',
  fontSize: 13,
  whiteSpace: 'nowrap'
}
