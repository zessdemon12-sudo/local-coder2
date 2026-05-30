import { useRef, useEffect } from 'react'
import Editor, { loader, DiffEditor } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'

loader.config({ monaco })

const LANGUAGE_MAP: Record<string, string> = {
  js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
  py: 'python', json: 'json', html: 'html', css: 'css',
  md: 'markdown', xml: 'xml', sql: 'sql', rs: 'rust',
  java: 'java', cpp: 'cpp', c: 'cpp', h: 'cpp', hpp: 'cpp'
}

function mapLanguage(lang?: string): string {
  return LANGUAGE_MAP[lang || ''] || 'javascript'
}

const monacoTheme = {
  base: 'vs-dark' as const,
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#1a1a2e',
    'editor.foreground': '#e0e0e0',
    'editor.lineHighlightBackground': '#2a2a3e',
    'editor.selectionBackground': '#3a3a5e'
  }
}

export function MonacoCodeViewer({ content, language }: { content: string; language?: string }) {
  const lang = mapLanguage(language)

  return (
    <div style={{
      height: 200,
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
      border: '1px solid var(--border)',
      margin: '8px 0'
    }}>
      <Editor
        height="100%"
        language={lang}
        value={content}
        theme="myTheme"
        beforeMount={(monaco) => {
          monaco.editor.defineTheme('myTheme', monacoTheme)
        }}
        options={{
          readOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 13,
          fontFamily: 'var(--font-mono, "Cascadia Code", monospace)',
          lineNumbers: 'off',
          folding: false,
          renderLineHighlight: 'none',
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          overviewRulerBorder: false,
          scrollbar: { vertical: 'hidden', horizontal: 'auto' },
          padding: { top: 8, bottom: 8 }
        }}
      />
    </div>
  )
}

interface MonacoDiffViewerProps {
  oldContent: string
  newContent: string
  language?: string
  title?: string
}

export function MonacoDiffViewer({ oldContent, newContent, language, title }: MonacoDiffViewerProps) {
  const lang = mapLanguage(language)

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
      <div style={{ height: 300 }}>
        <DiffEditor
          height="100%"
          language={lang}
          original={oldContent}
          modified={newContent}
          theme="myTheme"
          beforeMount={(monaco) => {
            monaco.editor.defineTheme('myTheme', monacoTheme)
          }}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 12,
            fontFamily: 'var(--font-mono, "Cascadia Code", monospace)',
            renderSideBySide: true,
            originalEditable: false,
            lineNumbers: 'on',
            folding: false,
            renderLineHighlight: 'none',
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            overviewRulerBorder: false,
            scrollbar: { vertical: 'hidden', horizontal: 'auto' },
            padding: { top: 4, bottom: 4 }
          }}
        />
      </div>
    </div>
  )
}
