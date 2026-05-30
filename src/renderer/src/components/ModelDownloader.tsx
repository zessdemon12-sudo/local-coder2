import { useState } from 'react'

export function ModelDownloaderView() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<{
    id: string
    downloads: number
    likes: number
    files?: Array<{ name: string; size: number; downloadUrl: string }>
  }> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const url = `https://huggingface.co/api/models?search=${encodeURIComponent(query)}&library=gguf&sort=downloads&direction=-1&limit=10`
      const response = await fetch(url)
      if (!response.ok) throw new Error(`API error: ${response.status}`)
      const data = await response.json()
      setResults(data.map((m: Record<string, unknown>) => ({
        id: m.id as string,
        downloads: (m.downloads as number) || 0,
        likes: (m.likes as number) || 0
      })))
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleListFiles = async (repoId: string) => {
    try {
      const url = `https://huggingface.co/api/models/${repoId}/tree/main`
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Failed to list files: ${response.status}`)
      const files = await response.json() as Array<Record<string, unknown>>
      const ggufFiles = files
        .filter((f: Record<string, unknown>) => (f.rfilename as string || '').endsWith('.gguf'))
        .map((f: Record<string, unknown>) => ({
          name: f.rfilename as string,
          size: (f.size as number) || 0,
          downloadUrl: `https://huggingface.co/${repoId}/resolve/main/${f.rfilename}`
        }))
      setResults(prev => prev?.map(r =>
        r.id === repoId ? { ...r, files: ggufFiles } : r
      ) || null)
    } catch (err) {
      setError(String(err))
    }
  }

  const formatSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
  }

  const handleDownload = (url: string, name: string) => {
    const api = (window as any).electronApi
    api?.openExternal(url)
  }

  return (
    <div>
      <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
        Browse Models
      </h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
        Search HuggingFace for GGUF models. Click a model to see available files, then download to your preferred location.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Search models (e.g. llama, qwen, codestral)..."
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            fontSize: 13,
            outline: 'none'
          }}
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          style={{
            padding: '8px 14px',
            borderRadius: 'var(--radius)',
            border: 'none',
            background: 'var(--accent)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 500
          }}
        >
          {loading ? '...' : 'Search'}
        </button>
      </div>

      {error && (
        <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8 }}>{error}</div>
      )}

      {results && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {results.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No models found</div>
          ) : (
            results.map((model) => (
              <div key={model.id} style={{
                padding: '8px 10px',
                borderRadius: 'var(--radius)',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)'
              }}>
                <div
                  onClick={() => !model.files && handleListFiles(model.id)}
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--accent)',
                    cursor: 'pointer',
                    wordBreak: 'break-all',
                    marginBottom: 4
                  }}
                >
                  {model.id}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {model.downloads.toLocaleString()} downloads &middot; {model.likes} likes
                </div>
                {model.files && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {model.files.slice(0, 5).map(file => (
                      <div key={file.name} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 11,
                        gap: 8
                      }}>
                        <span style={{ color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {file.name.split('/').pop()}
                        </span>
                        <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatSize(file.size)}</span>
                        <button
                          onClick={() => handleDownload(file.downloadUrl, file.name)}
                          style={{
                            padding: '2px 8px',
                            borderRadius: 'var(--radius)',
                            border: '1px solid var(--accent)',
                            background: 'transparent',
                            color: 'var(--accent)',
                            fontSize: 10,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          Download
                        </button>
                      </div>
                    ))}
                    {model.files.length > 5 && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        +{model.files.length - 5} more files
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
