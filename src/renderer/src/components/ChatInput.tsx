import { useState, useRef } from 'react'
import { useAppStore } from '../store/chat-store'

const DOC_ACCEPT = '.txt,.md,.json,.yaml,.yml,.toml,.csv,.xml,.css,.html,.js,.jsx,.ts,.tsx,.mjs,.cjs,.vue,.svelte,.py,.rb,.php,.go,.rs,.java,.kt,.swift,.c,.cpp,.h,.hpp,.sh,.bash,.zsh,.ps1,.bat,.cmd,.sql,.r,.scala,.ex,.exs,.erl,.hs,.lua,.zig,.nim,.dart,.sol,.tf,.env,.ini,.cfg,.conf,.log'

function langFromName(name: string): string | undefined {
  const ext = name.split('.').pop()?.toLowerCase()
  if (!ext) return undefined
  const map: Record<string, string> = {
    js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
    ts: 'typescript', tsx: 'typescript', vue: 'vue', svelte: 'svelte',
    py: 'python', rb: 'ruby', php: 'php', go: 'go', rs: 'rust',
    java: 'java', kt: 'kotlin', swift: 'swift', c: 'c', cpp: 'cpp',
    h: 'c', hpp: 'cpp', sh: 'bash', bash: 'bash', zsh: 'bash',
    ps1: 'powershell', bat: 'batch', cmd: 'batch',
    json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml',
    xml: 'xml', csv: 'csv', md: 'markdown', sql: 'sql',
    css: 'css', html: 'html', r: 'r', scala: 'scala',
    lua: 'lua', dart: 'dart', zig: 'zig', nim: 'nim',
    sol: 'solidity', tf: 'terraform', env: 'dotenv'
  }
  return map[ext]
}

export function ChatInput() {
  const [input, setInput] = useState('')
  const [pendingImages, setPendingImages] = useState<Array<{ mimeType: string; base64: string; preview: string }>>([])
  const [pendingDocuments, setPendingDocuments] = useState<Array<{ name: string; content: string; language?: string }>>([])
  const addMessage = useAppStore(s => s.addMessage)
  const setIsStreaming = useAppStore(s => s.setIsStreaming)
  const setIsProcessing = useAppStore(s => s.setIsProcessing)
  const isStreaming = useAppStore(s => s.isStreaming)
  const isProcessing = useAppStore(s => s.isProcessing)
  const setStreamingContent = useAppStore(s => s.setStreamingContent)
  const systemPrompt = useAppStore(s => s.systemPrompt)
  const workspaceDir = useAppStore(s => s.workspaceDir)
  const fastInput = useAppStore(s => s.fastInput)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const imageFileRef = useRef<HTMLInputElement>(null)
  const docFileRef = useRef<HTMLInputElement>(null)

  const handleSend = async () => {
    const text = input.trim()
    if ((!text && !pendingImages.length && !pendingDocuments.length) || isStreaming) return

    const images = pendingImages.map(({ mimeType, base64 }) => ({ mimeType, base64 }))
    const documents = pendingDocuments.map(({ name, content, language }) => ({ name, content, language }))

    setInput('')
    setPendingImages([])
    setPendingDocuments([])
    addMessage({ role: 'user', content: text, images, documents })
    setStreamingContent('')
    setIsStreaming(true)
    setIsProcessing(true)

    try {
      const api = (window as any).electronApi
      await api.chatSend({ text, systemPrompt, workspaceDir, images, documents })
    } catch (err) {
      addMessage({ role: 'system', content: `Error: ${String(err)}` })
      setIsStreaming(false)
      setIsProcessing(false)
    }
  }

  const handleStop = () => {
    const api = (window as any).electronApi
    api?.chatStop()
    setIsStreaming(false)
    setIsProcessing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (fastInput || !e.shiftKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleImagePick = () => {
    imageFileRef.current?.click()
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        const base64 = result.split(',')[1]
        setPendingImages(prev => [...prev, { mimeType: file.type, base64, preview: result }])
      }
      reader.readAsDataURL(file)
    }
    e.target.value = ''
  }

  const removeImage = (index: number) => {
    setPendingImages(prev => prev.filter((_, i) => i !== index))
  }

  const handleDocPick = () => {
    docFileRef.current?.click()
  }

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    for (const file of Array.from(files)) {
      const reader = new FileReader()
      reader.onload = () => {
        const content = reader.result as string
        const language = langFromName(file.name)
        setPendingDocuments(prev => [...prev, { name: file.name, content, language }])
      }
      reader.readAsText(file)
    }
    e.target.value = ''
  }

  const removeDocument = (index: number) => {
    setPendingDocuments(prev => prev.filter((_, i) => i !== index))
  }

  // --- STT / Voice input ---
  const [recording, setRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const handleMicClick = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop()
      setRecording(false)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const reader = new FileReader()
        reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1]
          setRecording(false)
          try {
            const api = (window as any).electronApi
            const res = await api.sttTranscribe(base64)
            if (res.success && res.text) {
              setInput(prev => (prev ? prev + ' ' : '') + res.text)
              textRef.current?.focus()
            }
          } catch { }
        }
        reader.readAsDataURL(blob)
      }

      recorder.onerror = () => {
        stream.getTracks().forEach(t => t.stop())
        setRecording(false)
      }

      recorder.start()
      setRecording(true)
    } catch { }
  }

  const hasAttachments = pendingImages.length > 0 || pendingDocuments.length > 0
  const canSend = input.trim().length > 0 || hasAttachments

  const [dragOver, setDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => setDragOver(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          const base64 = result.split(',')[1]
          setPendingImages(prev => [...prev, { mimeType: file.type, base64, preview: result }])
        }
        reader.readAsDataURL(file)
      } else {
        const reader = new FileReader()
        reader.onload = () => {
          const content = reader.result as string
          const language = langFromName(file.name)
          setPendingDocuments(prev => [...prev, { name: file.name, content, language }])
        }
        reader.readAsText(file)
      }
    }
  }

  return (
    <div style={{
      padding: '12px 16px',
      borderTop: '1px solid var(--border)',
      background: dragOver ? 'var(--bg-hover)' : 'var(--bg-secondary)',
      transition: 'background 0.15s'
    }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {hasAttachments && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          {pendingDocuments.map((doc, i) => (
            <div key={`doc-${i}`} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', borderRadius: 6,
              border: '1px solid var(--border)', background: 'var(--bg-tertiary)',
              fontSize: 12, maxWidth: 200
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                📄 {doc.name}
              </span>
              <button onClick={() => removeDocument(i)}
                style={{
                  background: 'none', border: 'none', color: 'var(--danger)',
                  fontSize: 14, cursor: 'pointer', padding: 0, lineHeight: 1,
                  flexShrink: 0
                }}>×</button>
            </div>
          ))}
          {pendingImages.map((img, i) => (
            <div key={`img-${i}`} style={{ position: 'relative', width: 56, height: 56 }}>
              <img src={img.preview} alt=""
                style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
              <button onClick={() => removeImage(i)}
                style={{
                  position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%',
                  border: 'none', background: 'var(--danger)', color: '#fff', fontSize: 11, lineHeight: '18px',
                  textAlign: 'center', cursor: 'pointer', padding: 0
                }}>×</button>
            </div>
          ))}
        </div>
      )}
      <div style={{
        display: 'flex',
        gap: 8,
        alignItems: 'flex-end'
      }}>
        <input ref={imageFileRef} type="file" accept="image/*" multiple
          onChange={handleImageChange} style={{ display: 'none' }} />
        <input ref={docFileRef} type="file" accept={DOC_ACCEPT} multiple
          onChange={handleDocChange} style={{ display: 'none' }} />
        <button onClick={handleImagePick}
          title="Attach image"
          style={{
            padding: '10px 10px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
            fontSize: 16, cursor: 'pointer', lineHeight: 1
          }}>
          🖼
        </button>
        <button onClick={handleDocPick}
          title="Attach document"
          style={{
            padding: '10px 10px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
            fontSize: 16, cursor: 'pointer', lineHeight: 1
          }}>
          📄
        </button>
        <button onClick={handleMicClick}
          title={recording ? 'Stop recording' : 'Record audio (STT)'}
          style={{
            padding: '10px 10px',
            borderRadius: 'var(--radius)',
            border: recording ? '1px solid var(--danger)' : '1px solid var(--border)',
            background: recording ? 'rgba(239,68,68,0.15)' : 'var(--bg-tertiary)',
            color: recording ? 'var(--danger)' : 'var(--text-secondary)',
            fontSize: 16, cursor: 'pointer', lineHeight: 1,
            animation: recording ? 'pulse 1s infinite' : 'none'
          }}>
          🎤
        </button>
        <textarea
          ref={textRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask me to write code, edit files, or run commands..."
          rows={1}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            fontSize: 14,
            resize: 'none',
            outline: 'none',
            maxHeight: 150,
            fontFamily: 'var(--font-sans)',
            lineHeight: 1.5
          }}
        />
        {isStreaming || isProcessing ? (
          <button
            onClick={handleStop}
            style={{
              padding: '10px 20px',
              borderRadius: 'var(--radius)',
              border: 'none',
              background: 'var(--danger)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 14,
              whiteSpace: 'nowrap'
            }}
          >
            Stop
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!canSend}
            style={{
              padding: '10px 20px',
              borderRadius: 'var(--radius)',
              border: 'none',
              background: canSend ? 'var(--accent)' : 'var(--bg-hover)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 14,
              opacity: canSend ? 1 : 0.5,
              whiteSpace: 'nowrap'
            }}
          >
            Send
          </button>
        )}
      </div>
    </div>
  )
}
