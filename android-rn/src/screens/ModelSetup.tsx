import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator
} from 'react-native'
import { theme } from '../theme'
import { useAppStore, ModelBackend } from '../store/chat-store'
import { llmApi } from '../api/llm-bridge'

export default function ModelSetupScreen() {
  const setModelConfig = useAppStore(s => s.setModelConfig)
  const setModelLoaded = useAppStore(s => s.setModelLoaded)

  const [backend, setBackend] = useState<ModelBackend>('openrouter')
  const [apiUrl, setApiUrl] = useState('https://openrouter.ai/api/v1')
  const [apiKey, setApiKey] = useState('')
  const [modelName, setModelName] = useState('')
  const [contextSize, setContextSize] = useState('4096')
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')

  const handleConnect = async () => {
    setConnecting(true)
    setError('')
    try {
      const config = {
        backend,
        apiUrl,
        apiKey,
        modelName,
        contextSize: parseInt(contextSize) || 4096
      }
      const ok = await llmApi.testConnection(config)
      if (!ok) throw new Error('Connection failed — check URL and API key')
      setModelConfig(config)
      setModelLoaded(true)
    } catch (err) {
      setError(String(err))
    }
    setConnecting(false)
  }

  const btnStyle = (active: boolean) => ({
    flex: 1,
    paddingVertical: 12,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: active ? theme.accent : theme.border,
    backgroundColor: active ? theme.accent : theme.bgTertiary,
    alignItems: 'center' as const
  })

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Local Coder</Text>
      <Text style={styles.subtitle}>Connect to an LLM backend</Text>

      <View style={styles.row}>
        <TouchableOpacity onPress={() => setBackend('openrouter')} style={btnStyle(backend === 'openrouter')}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>OpenRouter</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setBackend('openai')} style={btnStyle(backend === 'openai')}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>API Server</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setBackend('llama')} style={btnStyle(backend === 'llama')}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>On-Device</Text>
        </TouchableOpacity>
      </View>

      {backend !== 'llama' ? (
        <>
          <Text style={styles.label}>API URL</Text>
          <TextInput
            style={styles.input}
            value={apiUrl}
            onChangeText={setApiUrl}
            placeholder="https://openrouter.ai/api/v1"
            placeholderTextColor={theme.textMuted}
          />

          <Text style={styles.label}>Model Name</Text>
          <TextInput
            style={styles.input}
            value={modelName}
            onChangeText={setModelName}
            placeholder="google/gemini-2.0-flash-001"
            placeholderTextColor={theme.textMuted}
          />

          <Text style={styles.label}>API Key</Text>
          <TextInput
            style={styles.input}
            value={apiKey}
            onChangeText={setApiKey}
            placeholder="sk-or-v1-..."
            placeholderTextColor={theme.textMuted}
            secureTextEntry
          />
        </>
      ) : (
        <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 12 }}>
          Uses on-device llama.cpp via the native module.
          Place GGUF models in the app's model directory.
        </Text>
      )}

      <Text style={styles.label}>Context Size</Text>
      <TextInput
        style={styles.input}
        value={contextSize}
        onChangeText={setContextSize}
        keyboardType="number-pad"
        placeholderTextColor={theme.textMuted}
      />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        onPress={handleConnect}
        disabled={connecting}
        style={[styles.connectBtn, connecting && { opacity: 0.6 }]}
      >
        {connecting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Connect</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 24, alignItems: 'center', paddingTop: 60 },
  title: { fontSize: 26, fontWeight: '700', color: theme.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: theme.textSecondary, marginBottom: 24 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 20, width: '100%' },
  label: { fontSize: 12, fontWeight: '600', color: theme.textSecondary, alignSelf: 'flex-start', marginBottom: 4, marginTop: 8 },
  input: {
    width: '100%',
    padding: 10,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bgTertiary,
    color: theme.text,
    fontSize: 14
  },
  errorBox: {
    width: '100%',
    padding: 10,
    borderRadius: theme.radius,
    backgroundColor: 'rgba(255,107,107,0.1)',
    borderWidth: 1,
    borderColor: theme.danger,
    marginTop: 8
  },
  errorText: { color: theme.danger, fontSize: 13 },
  connectBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: theme.radius,
    backgroundColor: theme.accent,
    alignItems: 'center',
    marginTop: 20
  }
})
