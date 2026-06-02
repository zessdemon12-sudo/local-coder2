import { View, Text, StyleSheet } from 'react-native'
import { theme } from '../theme'

interface Props {
  message: {
    role: string
    content: string
  }
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  return (
    <View style={[
      styles.bubble,
      isUser ? styles.userBubble : styles.assistantBubble,
      isSystem && { borderColor: theme.warning }
    ]}>
      <Text style={[
        styles.role,
        isUser ? { color: theme.accent } : { color: theme.success }
      ]}>
        {isUser ? 'You' : isSystem ? 'System' : 'Assistant'}
      </Text>
      <Text style={styles.content}>{message.content}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  bubble: {
    padding: 12,
    borderRadius: theme.radiusLg,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bgSecondary,
    marginBottom: 8
  },
  userBubble: {
    borderColor: theme.accent + '40',
    backgroundColor: theme.bgTertiary
  },
  assistantBubble: {},
  role: { fontSize: 11, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase' },
  content: { fontSize: 14, color: theme.text, lineHeight: 20 }
})
