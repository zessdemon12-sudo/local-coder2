import { useAppStore } from '../store/chat-store'

export function ToolBar() {
  const setSidebarOpen = useAppStore(s => s.setSidebarOpen)
  const sidebarOpen = useAppStore(s => s.sidebarOpen)
  const modelStatus = useAppStore(s => s.modelStatus)
  const messages = useAppStore(s => s.messages)

  return (
    <div style={{
      height: 'var(--header-height)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: 12,
      background: 'var(--bg-secondary)'
    }}>
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: 18,
            padding: '4px 8px'
          }}
        >
          &#9776;
        </button>
      )}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        color: 'var(--text-muted)'
      }}>
        <span style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: modelStatus.loaded ? 'var(--success)' : 'var(--danger)',
          display: 'inline-block'
        }} />
        {modelStatus.loaded
          ? (modelStatus.config?.backend === 'llama-server'
            ? (modelStatus.config.modelPath || '').split(/[/\\]/).pop() || 'GGUF'
            : modelStatus.config?.modelName || 'Connected')
          : 'Disconnected'}
      </div>
      <div style={{ flex: 1 }} />
      {modelStatus.config?.apiUrl && (
        <div style={{
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)',
          background: 'var(--bg-tertiary)',
          padding: '2px 8px',
          borderRadius: 4,
          border: '1px solid var(--border)'
        }}>
          {modelStatus.config.apiUrl}
        </div>
      )}
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        {messages.length} messages
      </div>
    </div>
  )
}
