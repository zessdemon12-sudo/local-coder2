import { useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import { useAppStore } from '../store/chat-store'

interface MessageBubbleProps {
  index: number
  message: {
    role: 'user' | 'assistant' | 'system'
    content: string
    images?: Array<{ mimeType: string; base64: string }>
    documents?: Array<{ name: string; content: string; language?: string }>
    toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>
  }
  isStreaming?: boolean
  isSpeaking?: boolean
}

export function MessageBubble({ index, message, isStreaming, isSpeaking }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const tts = useAppStore(s => s.tts)
  const setTtsState = useAppStore(s => s.setTtsState)

  const handleSpeak = useCallback(async () => {
    if (tts.backend === 'llama-tts' && !tts.modelPath) return
    if (isSpeaking) return
    setTtsState({ speakingMessageIndex: index, speaking: true })
    try {
      const api = (window as any).electronApi
      const res = await api.ttsSynthesize(message.content, tts.modelPath || '', tts.vocoderPath || undefined, tts.backend)
      if (res.success && res.audio) {
        const audio = new Audio(`data:audio/wav;base64,${res.audio}`)
        audio.onended = () => setTtsState({ speakingMessageIndex: null, speaking: false })
        audio.onerror = () => setTtsState({ speakingMessageIndex: null, speaking: false })
        await audio.play()
      } else {
        setTtsState({ speakingMessageIndex: null, speaking: false })
      }
    } catch {
      setTtsState({ speakingMessageIndex: null, speaking: false })
    }
  }, [message.content, tts.modelPath, tts.vocoderPath, tts.backend, index, isSpeaking, setTtsState])

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      padding: '4px 16px',
      marginBottom: 4
    }}>
      <div style={{
        maxWidth: '80%',
        padding: '10px 14px',
        borderRadius: 'var(--radius-lg)',
        background: isUser
          ? 'var(--accent)'
          : isSystem
            ? 'rgba(255,107,107,0.1)'
            : 'var(--bg-secondary)',
        border: isSystem ? '1px solid rgba(255,107,107,0.3)' : '1px solid var(--border)',
        color: isUser ? '#fff' : 'var(--text-primary)',
        fontSize: 14,
        lineHeight: 1.6,
        wordBreak: 'break-word'
      }}>
        {message.documents?.map((doc, i) => (
          <div key={`doc-${i}`} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', marginBottom: 6,
            borderRadius: 6, border: '1px solid var(--border)',
            background: 'var(--bg-tertiary)', fontSize: 12,
            color: isUser ? '#d0d0ff' : 'var(--text-secondary)'
          }}>
            <span>📄 {doc.name}</span>
            {doc.language && <span style={{ opacity: 0.6 }}>({doc.language})</span>}
            <span style={{ marginLeft: 'auto', opacity: 0.5, fontSize: 11 }}>
              {doc.content.length} chars
            </span>
          </div>
        ))}
        {message.images?.map((img, i) => (
          <img key={i}
            src={`data:${img.mimeType};base64,${img.base64}`}
            alt=""
            style={{
              maxWidth: '100%', maxHeight: 300, borderRadius: 6, marginBottom: 8, display: 'block'
            }} />
        ))}
        {isUser ? (
          <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
        ) : (
          <div className="markdown-content">
            <ReactMarkdown
              rehypePlugins={[rehypeHighlight]}
              components={{
                pre: ({ children }) => (
                  <pre style={{
                    background: 'var(--bg-tertiary)',
                    padding: 12,
                    borderRadius: 'var(--radius)',
                    overflow: 'auto',
                    fontSize: 13,
                    fontFamily: 'var(--font-mono)',
                    margin: '8px 0'
                  }}>{children}</pre>
                ),
                code: ({ className, children, ...props }) => {
                  const isInline = !className
                  return isInline ? (
                    <code style={{
                      background: 'var(--bg-tertiary)',
                      padding: '2px 6px',
                      borderRadius: 3,
                      fontSize: 13,
                      fontFamily: 'var(--font-mono)'
                    }} {...props}>{children}</code>
                  ) : (
                    <code className={className} {...props}>{children}</code>
                  )
                }
              }}
            >
              {message.content}
            </ReactMarkdown>
            {isStreaming && (
              <span style={{
                display: 'inline-block',
                width: 8,
                height: 16,
                background: 'var(--accent)',
                animation: 'blink 1s step-end infinite',
                marginLeft: 2,
                verticalAlign: 'middle'
              }} />
            )}
            {!isStreaming && (
              <button
                onClick={handleSpeak}
                disabled={
                  (tts.backend === 'llama-tts' && !tts.modelPath) || isSpeaking
                }
                title={
                  isSpeaking ? 'Speaking...'
                  : tts.backend === 'llama-tts' && !tts.modelPath ? 'Configure TTS model in Settings'
                  : 'Read aloud'
                }
                style={{
                  background: 'none', border: 'none',
                  cursor: (tts.backend === 'llama-tts' && !tts.modelPath) || isSpeaking ? 'default' : 'pointer',
                  fontSize: 13, padding: '2px 4px', marginTop: 4,
                  display: 'inline-flex', alignItems: 'center',
                  opacity: (tts.backend === 'llama-tts' && !tts.modelPath) ? 0.2 : isSpeaking ? 0.4 : 0.5,
                  transition: 'opacity 0.15s',
                  color: 'var(--text-muted)'
                }}
                onMouseEnter={e => {
                  if (tts.modelPath && !isSpeaking) (e.target as HTMLElement).style.opacity = '1'
                }}
                onMouseLeave={e => {
                  if (tts.modelPath && !isSpeaking) (e.target as HTMLElement).style.opacity = '0.5'
                }}
              >
                {isSpeaking ? '🔇' : '🔊'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
