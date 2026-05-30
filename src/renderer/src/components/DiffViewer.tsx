import { useEffect, useRef } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { json } from '@codemirror/lang-json'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { markdown } from '@codemirror/lang-markdown'
import { xml } from '@codemirror/lang-xml'
import { sql } from '@codemirror/lang-sql'
import { rust } from '@codemirror/lang-rust'
import { java } from '@codemirror/lang-java'
import { cpp } from '@codemirror/lang-cpp'
import { oneDark } from '@codemirror/theme-one-dark'
import { useAppStore } from '../store/chat-store'
import { MonacoCodeViewer, MonacoDiffViewer } from './MonacoViewer'

export interface DiffViewerProps {
  oldContent: string
  newContent: string
  language?: string
  title?: string
}

function getLanguageExt(lang?: string) {
  const map: Record<string, unknown> = {
    js: javascript(), jsx: javascript({ jsx: true }),
    ts: javascript({ typescript: true }), tsx: javascript({ jsx: true, typescript: true }),
    py: python(), json: json(),
    html: html(), css: css(),
    md: markdown(), xml: xml(),
    sql: sql(), rs: rust(),
    java: java(), cpp: cpp(), c: cpp(),
    h: cpp(), hpp: cpp()
  }
  return map[lang || ''] || javascript()
}

function CodeMirrorBlock({ content, language }: { content: string; language?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    if (!ref.current) return
    if (viewRef.current) {
      viewRef.current.destroy()
    }
    const state = EditorState.create({
      doc: content,
      extensions: [
        basicSetup,
        getLanguageExt(language),
        oneDark,
        EditorView.editable.of(false),
        EditorView.theme({
          '&': { backgroundColor: 'var(--bg-tertiary)', fontSize: '13px' },
          '.cm-scroller': { fontFamily: 'var(--font-mono)' },
          '&.cm-editor': { height: '100%' },
          '.cm-gutters': { display: 'none' }
        })
      ]
    })
    viewRef.current = new EditorView({ state, parent: ref.current })
    return () => viewRef.current?.destroy()
  }, [content, language])

  return <div ref={ref} style={{ height: '100%', overflow: 'auto' }} />
}

function CodeMirrorDiffViewer({ oldContent, newContent, language, title }: DiffViewerProps) {
  const oldRef = useRef<HTMLDivElement>(null)
  const newRef = useRef<HTMLDivElement>(null)
  const oldViewRef = useRef<EditorView | null>(null)
  const newViewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    if (!oldRef.current || !newRef.current) return
    oldViewRef.current?.destroy()
    newViewRef.current?.destroy()

    const extensions = [
      basicSetup,
      getLanguageExt(language),
      oneDark,
      EditorView.theme({
        '&': { backgroundColor: 'var(--bg-tertiary)', fontSize: '12px' },
        '.cm-scroller': { fontFamily: 'var(--font-mono)' },
        '&.cm-editor': { height: '100%' },
        '.cm-gutters': { display: 'none' }
      })
    ]

    const oldState = EditorState.create({
      doc: oldContent,
      extensions: [...extensions, EditorView.editable.of(false)]
    })
    const newState = EditorState.create({
      doc: newContent,
      extensions: [...extensions, EditorView.editable.of(false)]
    })

    oldViewRef.current = new EditorView({ state: oldState, parent: oldRef.current })
    newViewRef.current = new EditorView({ state: newState, parent: newRef.current })

    return () => {
      oldViewRef.current?.destroy()
      newViewRef.current?.destroy()
    }
  }, [oldContent, newContent, language])

  return (
    <div style={{
      borderRadius: 'var(--radius)',
      border: '1px solid var(--border)',
      overflow: 'hidden',
      margin: '8px 0'
    }}>
      {title && (
        <div style={{
          padding: '6px 12px',
          background: 'var(--bg-hover)',
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--text-secondary)',
          borderBottom: '1px solid var(--border)'
        }}>
          {title}
        </div>
      )}
      <div style={{ display: 'flex', height: 300 }}>
        <div style={{ flex: 1, overflow: 'hidden', borderRight: '1px solid var(--border)' }}>
          <div style={{ padding: '4px 8px', fontSize: 11, color: 'var(--danger)', background: 'rgba(255,107,107,0.05)' }}>
            Old
          </div>
          <div ref={oldRef} style={{ height: 'calc(100% - 24px)', overflow: 'auto' }} />
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ padding: '4px 8px', fontSize: 11, color: 'var(--success)', background: 'rgba(81,207,102,0.05)' }}>
            New
          </div>
          <div ref={newRef} style={{ height: 'calc(100% - 24px)', overflow: 'auto' }} />
        </div>
      </div>
    </div>
  )
}

function CodeMirrorCodeViewer({ content, language }: { content: string; language?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    if (!ref.current) return
    viewRef.current?.destroy()
    const state = EditorState.create({
      doc: content,
      extensions: [
        basicSetup,
        getLanguageExt(language),
        oneDark,
        EditorView.editable.of(false),
        EditorView.theme({
          '&': { backgroundColor: 'var(--bg-tertiary)', fontSize: '13px' },
          '.cm-scroller': { fontFamily: 'var(--font-mono)' },
          '&.cm-editor': { height: '100%' },
          '.cm-gutters': { display: 'none' }
        })
      ]
    })
    viewRef.current = new EditorView({ state, parent: ref.current })
    return () => viewRef.current?.destroy()
  }, [content, language])

  return (
    <div ref={ref} style={{
      height: 200,
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
      border: '1px solid var(--border)',
      margin: '8px 0'
    }} />
  )
}

export function DiffViewer(props: DiffViewerProps) {
  const useMonaco = useAppStore(s => s.editorPreference) === 'monaco'
  if (useMonaco) {
    return <MonacoDiffViewer {...props} />
  }
  return <CodeMirrorDiffViewer {...props} />
}

export function CodeViewer({ content, language }: { content: string; language?: string }) {
  const useMonaco = useAppStore(s => s.editorPreference) === 'monaco'
  if (useMonaco) {
    return <MonacoCodeViewer content={content} language={language} />
  }
  return <CodeMirrorCodeViewer content={content} language={language} />
}
