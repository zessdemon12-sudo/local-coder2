import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Platform
} from 'react-native'
import { theme } from '../theme'
import { useAppStore } from '../store/chat-store'
import { llmApi } from '../api/llm-bridge'

export default function ChatInput() {
  const [input, setInput] = useState('')
  const addMessage = useAppStore(s => s.addMessage)
  const setIsStreaming = useAppStore(s => s.setIsStreaming)
  const setIsProcessing = useAppStore(s => s.setIsProcessing)
  const isStreaming = useAppStore(s => s.isStreaming)
  const modelConfig = useAppStore(s => s.modelConfig)
  const setStreamingContent = useAppStore(s => s.setStreamingContent)
  const messages = useAppStore(s => s.messages)

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isStreaming || !modelConfig) return
    setInput('')
    addMessage({ role: 'user', content: text })
    setStreamingContent('')
    setIsStreaming(true)
    setIsProcessing(true)

    try {
      await llmApi.chat(modelConfig, [...messages, { role: 'user', content: text }], {
        onToken: (token) => {
          useAppStore.getState().appendStreamingContent(token)
        },
        onDone: (content) => {
          addMessage({ role: 'assistant', content })
          setStreamingContent('')
          setIsStreaming(false)
          setIsProcessing(false)
        },
        onError: (error) => {
          addMessage({ role: 'system', content: `Error: ${error}` })
          setIsStreaming(false)
          setIsProcessing(false)
        }
      })
    } catch (err) {
      addMessage({ role: 'system', content: `Error: ${String(err)}` })
      setIsStreaming(false)
      setIsProcessing(false)
    }
  }

  return (
    <View style={styles.container}>
      <TextInput
        value={input}
        onChangeText={setInput}
        placeholder="Ask me to write code..."
        placeholderTextColor={theme.textMuted}
        multiline
        style={styles.input}
      />
      <TouchableOpacity
        onPress={handleSend}
        disabled={!input.trim() || isStreaming}
        style={[styles.sendBtn, (!input.trim() || isStreaming) && { opacity: 0.4 }]}
      >
        <Text style={{ color: '#fff', fontWeight: '700' }}>
          {isStreaming ? '...' : 'Send'}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', padding: 12, gap: 8,
    borderTopWidth: 1, borderTopColor: theme.border,
    backgroundColor: theme.bgSecondary, alignItems: 'flex-end'
  },
  input: {
    flex: 1,
    padding: 10,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bgTertiary,
    color: theme.text,
    fontSize: 14,
    maxHeight: 100
  },
  sendBtn: {
    paddingVertical: 10, paddingHorizontal: 20,
    borderRadius: theme.radius,
    backgroundColor: theme.accent,
    alignItems: 'center'
  }
})
