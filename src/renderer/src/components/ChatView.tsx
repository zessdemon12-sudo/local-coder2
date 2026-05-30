import { useRef, useEffect } from 'react'
import { useAppStore } from '../store/chat-store'
import { MessageBubble } from './MessageBubble'
import { ChatInput } from './ChatInput'

export function ChatView() {
  const messages = useAppStore(s => s.messages)
  const streamingContent = useAppStore(s => s.streamingContent)
  const isStreaming = useAppStore(s => s.isStreaming)
  const tts = useAppStore(s => s.tts)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const hasContent = messages.length > 0 || streamingContent

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      background: 'var(--bg-primary)'
    }}>
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 0'
      }}>
        {!hasContent ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-muted)',
            padding: 40,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>&lt;/&gt;</div>
            <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 8, color: 'var(--text-secondary)' }}>
              Local Coder
            </h2>
            <p style={{ fontSize: 14, maxWidth: 400, lineHeight: 1.6 }}>
              Your fully local AI coding assistant. Ask me to write code, edit files, search your project, or run commands.
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <MessageBubble key={i} index={i} message={msg} isSpeaking={tts.speakingMessageIndex === i} />
            ))}
            {isStreaming && streamingContent && (
              <MessageBubble
                index={-1}
                message={{ role: 'assistant', content: streamingContent }}
                isStreaming
              />
            )}
          </>
        )}
        <div ref={endRef} />
      </div>
      <ChatInput />
    </div>
  )
}
