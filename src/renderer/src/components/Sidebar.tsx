import { useAppStore } from '../store/chat-store'

function formatTokens(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return String(n)
}

export function Sidebar() {
  const setSidebarOpen = useAppStore(s => s.setSidebarOpen)
  const messages = useAppStore(s => s.messages)
  const modelStatus = useAppStore(s => s.modelStatus)
  const setShowSettings = useAppStore(s => s.setShowSettings)
  const reset = useAppStore(s => s.reset)
  const workspaceDir = useAppStore(s => s.workspaceDir)
  const setWorkspaceDir = useAppStore(s => s.setWorkspaceDir)
  const inputTokens = useAppStore(s => s.inputTokens)
  const outputTokens = useAppStore(s => s.outputTokens)

  const handleSelectWorkspace = async () => {
    const api = (window as any).electronApi
    if (!api) return
    const dir = await api.selectWorkspace()
    if (dir) {
      setWorkspaceDir(dir)
      api.updateWorkspaceDir(dir)
    }
  }

  const handleChangeWorkspace = async () => {
    const api = (window as any).electronApi
    if (!api) return
    const dir = await api.selectWorkspace()
    if (dir) {
      setWorkspaceDir(dir)
      api.updateWorkspaceDir(dir)
    } else {
      setWorkspaceDir(null)
      api.updateWorkspaceDir(null)
    }
  }

  const handleNewChat = () => {
    const api = (window as any).electronApi
    api?.chatReset()
    reset()
  }

  const modelName = modelStatus.config?.backend === 'llama-server'
    ? (modelStatus.config.modelPath || '').split(/[/\\]/).pop() || 'GGUF'
    : modelStatus.config?.modelName || modelStatus.config?.apiUrl?.replace(/^https?:\/\//, '').split(':')[0] || 'API'

  const healthColor = modelStatus.loaded ? 'var(--success)'
    : modelStatus.loading ? 'var(--warning)'
    : modelStatus.error ? 'var(--danger)'
    : 'var(--text-muted)'

  const healthLabel = modelStatus.loaded ? 'Connected'
    : modelStatus.loading ? 'Connecting...'
    : modelStatus.error ? 'Error'
    : 'Disconnected'

  return (
    <div style={{
      width: 'var(--sidebar-width)',
      minWidth: 'var(--sidebar-width)',
      height: '100vh',
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border)',
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
        <span style={{ fontWeight: 600, fontSize: 14 }}>Local Coder</span>
        <button
          onClick={() => setSidebarOpen(false)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: 18,
            padding: '2px 6px'
          }}
        >
          &times;
        </button>
      </div>

      <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={handleNewChat}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            fontSize: 13,
            textAlign: 'left'
          }}
        >
          + New Chat
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, padding: '4px 8px', marginBottom: 4 }}>
          Model
        </div>
        <div style={{
          padding: '8px 12px',
          borderRadius: 'var(--radius)',
          background: 'var(--bg-tertiary)',
          fontSize: 12,
          marginBottom: 12
        }}>
          <div style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>
            {modelName}
          </div>
          <div style={{
            color: healthColor,
            fontSize: 11,
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: healthColor, display: 'inline-block' }} />
            {healthLabel}
          </div>
        </div>

        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, padding: '4px 8px', marginBottom: 4 }}>
          Workspace
        </div>
        <div style={{ padding: '8px 12px', borderRadius: 'var(--radius)', fontSize: 12 }}>
          {workspaceDir ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{workspaceDir}</div>
              <button onClick={handleChangeWorkspace} style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent)',
                fontSize: 11,
                padding: 0,
                cursor: 'pointer',
                textAlign: 'left'
              }}>
                Change
              </button>
            </div>
          ) : (
            <button onClick={handleSelectWorkspace} style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              fontSize: 12,
              padding: 0,
              cursor: 'pointer'
            }}>
              Select workspace folder
            </button>
          )}
        </div>

        {(inputTokens > 0 || outputTokens > 0) && (
          <div style={{ padding: '8px 12px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, padding: '4px 8px', marginBottom: 4 }}>
              Tokens
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4c9aff', display: 'inline-block' }} />
                In: {formatTokens(inputTokens)}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#51cf66', display: 'inline-block' }} />
                Out: {formatTokens(outputTokens)}
              </span>
            </div>
          </div>
        )}
      </div>

      <div style={{
        padding: '8px 12px',
        borderTop: '1px solid var(--border)',
        fontSize: 12
      }}>
        <button
          onClick={() => setShowSettings(true)}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: 'var(--radius)',
            border: 'none',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: 13,
            textAlign: 'left'
          }}
        >
          Settings
        </button>
      </div>
    </div>
  )
}
