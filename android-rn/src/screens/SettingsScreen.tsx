import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { theme } from '../theme'
import { useAppStore } from '../store/chat-store'

const inputStyle: any = {
  padding: 10, borderRadius: theme.radius,
  borderWidth: 1, borderColor: theme.border,
  backgroundColor: theme.bgTertiary, color: theme.text, fontSize: 14,
  marginBottom: 6
}

export default function SettingsScreen({ onClose }: { onClose: () => void }) {
  const modelConfig = useAppStore(s => s.modelConfig)
  const setModelConfig = useAppStore(s => s.setModelConfig)
  const setModelLoaded = useAppStore(s => s.setModelLoaded)
  const reset = useAppStore(s => s.reset)

  const handleDisconnect = () => {
    reset()
    setModelConfig(null)
    setModelLoaded(false)
    onClose()
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={{ color: theme.textMuted, fontSize: 22 }}>✕</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Model</Text>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Backend:</Text>
        <Text style={styles.infoValue}>{modelConfig?.backend || 'none'}</Text>
      </View>
      {modelConfig?.modelName ? (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Model:</Text>
          <Text style={styles.infoValue}>{modelConfig.modelName}</Text>
        </View>
      ) : null}
      {modelConfig?.apiUrl ? (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>API URL:</Text>
          <Text style={styles.infoValue} numberOfLines={1}>{modelConfig.apiUrl}</Text>
        </View>
      ) : null}

      <TouchableOpacity onPress={handleDisconnect} style={styles.disconnectBtn}>
        <Text style={{ color: theme.danger, fontWeight: '600' }}>Disconnect & Switch Model</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '700', color: theme.text },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: theme.text, marginBottom: 8, marginTop: 16 },
  infoRow: { flexDirection: 'row', marginBottom: 4 },
  infoLabel: { fontSize: 13, color: theme.textMuted, width: 70 },
  infoValue: { fontSize: 13, color: theme.textSecondary, flex: 1 },
  disconnectBtn: {
    marginTop: 20, paddingVertical: 12, borderRadius: theme.radius,
    borderWidth: 1, borderColor: theme.danger,
    alignItems: 'center'
  }
})
