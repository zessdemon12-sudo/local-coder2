import { useAppStore } from '../store/chat-store'

export function ApprovalBar() {
  const pendingApproval = useAppStore(s => s.pendingApproval)
  const setPendingApproval = useAppStore(s => s.setPendingApproval)

  if (!pendingApproval) return null

  const handleApprove = () => {
    const api = (window as any).electronApi
    api?.approveTool(true)
    setPendingApproval(null)
  }

  const handleReject = () => {
    const api = (window as any).electronApi
    api?.approveTool(false)
    setPendingApproval(null)
  }

  const args = pendingApproval.args
  const filePath = (args.filePath as string) || ''
  const fileName = filePath.split(/[/\\]/).pop() || ''

  return (
    <div style={{
      padding: '12px 16px',
      margin: '8px 12px',
      borderRadius: 'var(--radius)',
      border: '1px solid var(--warning)',
      background: 'rgba(234,179,8,0.08)',
      fontSize: 13
    }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--warning)' }}>
        Approve File Change
      </div>
      <div style={{ color: 'var(--text-secondary)', marginBottom: 8, fontSize: 12 }}>
        Tool: <strong>{pendingApproval.tool}</strong>
        {fileName && <> on <strong>{fileName}</strong></>}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleApprove} style={{
          padding: '6px 16px',
          borderRadius: 'var(--radius)',
          border: 'none',
          background: 'var(--accent)',
          color: '#fff',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer'
        }}>
          Approve
        </button>
        <button onClick={handleReject} style={{
          padding: '6px 16px',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          background: 'transparent',
          color: 'var(--text-secondary)',
          fontSize: 12,
          cursor: 'pointer'
        }}>
          Reject
        </button>
      </div>
    </div>
  )
}
