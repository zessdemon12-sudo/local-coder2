import { useEffect } from 'react'
import { useAppStore } from './store/chat-store'
import { ChatView } from './components/ChatView'
import { Sidebar } from './components/Sidebar'
import { SettingsPanel } from './components/SettingsPanel'
import { ModelSetup } from './components/ModelSetup'
import { ToolBar } from './components/ToolBar'
import { ApprovalBar } from './components/ApprovalBar'

function App() {
  const sidebarOpen = useAppStore(s => s.sidebarOpen)
  const showSettings = useAppStore(s => s.showSettings)
  const setShowSettings = useAppStore(s => s.setShowSettings)
  const modelStatus = useAppStore(s => s.modelStatus)
  const setModelStatus = useAppStore(s => s.setModelStatus)
  const addMessage = useAppStore(s => s.addMessage)
  const appendStreamingContent = useAppStore(s => s.appendStreamingContent)
  const setStreamingContent = useAppStore(s => s.setStreamingContent)
  const setIsStreaming = useAppStore(s => s.setIsStreaming)
  const setIsProcessing = useAppStore(s => s.setIsProcessing)
  const setPendingApproval = useAppStore(s => s.setPendingApproval)
  const theme = useAppStore(s => s.theme)

  useEffect(() => {
    document.documentElement.classList.toggle('light-theme', theme === 'light')
  }, [theme])

  useEffect(() => {
    const cleanup = (window as any).electronApi?.onAgentEvent((event: any) => {
      switch (event.type) {
        case 'token':
          appendStreamingContent(event.data)
          break
        case 'tool_call':
          console.log('Tool call:', event.data)
          break
        case 'tool_result':
          console.log('Tool result:', event.data)
          break
        case 'tool_approval':
          setPendingApproval(event.data)
          break
        case 'error': {
          const partial = useAppStore.getState().streamingContent
          if (partial) addMessage({ role: 'assistant', content: partial })
          setStreamingContent('')
          addMessage({ role: 'system', content: `Error: ${event.data}` })
          setIsStreaming(false)
          setIsProcessing(false)
          break
        }
        case 'done': {
          const content = useAppStore.getState().streamingContent
          addMessage({ role: 'assistant', content })
          setStreamingContent('')
          setIsStreaming(false)
          setIsProcessing(false)
          break
        }
      }
    })
    return () => cleanup?.()
  }, [])

  if (!modelStatus.loaded && !modelStatus.loading && !modelStatus.error) {
    return <ModelSetup />
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      {sidebarOpen && <Sidebar />}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0
      }}>
        <ToolBar />
        <ApprovalBar />
        <ChatView />
      </div>
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  )
}

export default App
