import { spawn, ChildProcess } from 'child_process'
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdtempSync, rmdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const PYTHON = 'C:\\Python311\\python.exe'
const SCRIPT = (() => {
  const base = (process as any).resourcesPath || join(__dirname, '..', '..')
  return join(base, 'bin', 'stt', 'transcribe.py')
})()

export class SttEngine {
  private process: ChildProcess | null = null
  private requestId = 0
  private pending = new Map<number, { resolve: (v: string) => void; reject: (e: Error) => void }>()
  private buffer = ''
  private modelSize: string

  constructor(modelSize = 'tiny') {
    this.modelSize = modelSize
  }

  async start(): Promise<void> {
    if (this.process) return
    if (!existsSync(SCRIPT)) throw new Error(`STT script not found: ${SCRIPT}`)

    this.process = spawn(PYTHON, [SCRIPT, this.modelSize, 'int8'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    })

    this.process.stdout?.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString()
      const lines = this.buffer.split('\n')
      this.buffer = lines.pop() || ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const msg = JSON.parse(trimmed)
          const id = msg.id as number
          if (id !== undefined && this.pending.has(id)) {
            if (msg.error) this.pending.get(id)!.reject(new Error(msg.error))
            else this.pending.get(id)!.resolve(msg.text || '')
            this.pending.delete(id)
          }
        } catch { }
      }
    })

    this.process.stderr?.on('data', (chunk: Buffer) => {
      console.error('[stt]', chunk.toString().trim())
    })

    this.process.on('exit', (code) => {
      console.error(`[stt] exited with code ${code}`)
      this.process = null
      for (const [, p] of this.pending) p.reject(new Error('STT process exited'))
      this.pending.clear()
    })

    this.process.on('error', (err) => {
      console.error('[stt] error:', err.message)
    })
  }

  async transcribe(audioBase64: string): Promise<string> {
    await this.start()

    const tmpDir = mkdtempSync(join(tmpdir(), 'stt-'))
    const audioFile = join(tmpDir, 'audio.webm')

    const audioBuf = Buffer.from(audioBase64, 'base64')
    writeFileSync(audioFile, audioBuf)

    const id = ++this.requestId
    const req = JSON.stringify({ id, audio_path: audioFile }) + '\n'

    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve: (text) => {
          try { unlinkSync(audioFile); rmdirSync(tmpDir) } catch {}
          resolve(text)
        },
        reject: (err) => {
          try { unlinkSync(audioFile); rmdirSync(tmpDir) } catch {}
          reject(err)
        }
      })
      this.process?.stdin?.write(req)
    })
  }

  stop(): void {
    this.process?.kill()
    this.process = null
    for (const [, p] of this.pending) p.reject(new Error('STT stopped'))
    this.pending.clear()
  }
}
