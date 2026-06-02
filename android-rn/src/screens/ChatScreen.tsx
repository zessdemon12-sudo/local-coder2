import { useEffect, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, FlatList, StyleSheet, KeyboardAvoidingView, Platform
} from 'react-native'
import { theme } from '../theme'
import { useAppStore } from '../store/chat-store'
import { llmApi } from '../api/llm-bridge'
import MessageBubble from '../components/MessageBubble'

export default function ChatScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const messages = useAppStore(s => s.messages)
  const streamingContent = useAppStore(s => s.streamingContent)
  const isStreaming = useAppStore(s => s.isStreaming)
  const isProcessing = useAppStore(s => s.isProcessing)
  const modelConfig = useAppStore(s => s.modelConfig)
  const addMessage = useAppStore(s => s.addMessage)
  const setStreamingContent = useAppStore(s => s.setStreamingContent)
  const setIsStreaming = useAppStore(s => s.setIsStreaming)
  const setIsProcessing = useAppStore(s => s.setIsProcessing)

  const [input, setInput] = React.useState('')
  const flatRef = useRef<FlatList>(null)

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

  const displayMessages = streamingContent
    ? [...messages, { role: 'assistant' as const, content: streamingContent }]
    : messages

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Local Coder</Text>
        <TouchableOpacity onPress={onOpenSettings} style={styles.settingsBtn}>
          <Text style={{ color: theme.textMuted, fontSize: 20 }}>⚙</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatRef}
        data={displayMessages}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => <MessageBubble message={item} />}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16 }}
        onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: true })}
      />

      <View style={styles.inputRow}>
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
    </KeyboardAvoidingView>
  )
}

import React from 'react'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: theme.border,
    backgroundColor: theme.bgSecondary
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: theme.text },
  settingsBtn: { padding: 4 },
  inputRow: {
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
