import { StatusBar } from 'react-native'
import { useAppStore } from './src/store/chat-store'
import ModelSetupScreen from './src/screens/ModelSetup'
import ChatScreen from './src/screens/ChatScreen'
import SettingsScreen from './src/screens/SettingsScreen'

export default function App() {
  const modelLoaded = useAppStore(s => s.modelLoaded)
  const showSettings = useAppStore(s => s.showSettings)
  const setShowSettings = useAppStore(s => s.setShowSettings)

  if (!modelLoaded) {
    return (
      <>
        <StatusBar barStyle="light-content" backgroundColor="#1a1b1e" />
        <ModelSetupScreen />
      </>
    )
  }

  if (showSettings) {
    return (
      <>
        <StatusBar barStyle="light-content" backgroundColor="#1a1b1e" />
        <SettingsScreen onClose={() => setShowSettings(false)} />
      </>
    )
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#1a1b1e" />
      <ChatScreen onOpenSettings={() => setShowSettings(true)} />
    </>
  )
}
