import { spawn, ChildProcess } from 'child_process'
import { existsSync, mkdtempSync, readFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

export interface TtsConfig {
  modelPath: string
  vocoderPath?: string
}

export class TtsEngine {
  private config: TtsConfig
  private process: ChildProcess | null = null
  private abortController: AbortController | null = null

  constructor(config: TtsConfig) {
    this.config = config
  }

  async synthesize(text: string): Promise<string> {
    if (!this.config.modelPath || !this.config.modelPath.trim()) throw new Error(`No TTS model path configured (got: "${this.config.modelPath}")`)
    const llamaTtsPath = this.findLlamaTts()
    if (!llamaTtsPath) throw new Error('llama-tts.exe not found')

    const tmpDir = mkdtempSync(join(tmpdir(), 'tts-'))
    const outFile = join(tmpDir, 'out.wav')

    const args = ['-m', this.config.modelPath, '-fit', 'off', '-c', '4096', '-p', text, '-o', outFile]
    if (this.config.vocoderPath) {
      args.push('-mv', this.config.vocoderPath)
    }

    this.abortController = new AbortController()

    return new Promise((resolve, reject) => {
      const proc = spawn(llamaTtsPath, args, {
        stdio: 'pipe',
        signal: this.abortController!.signal
      })
      this.process = proc

      let stderr = ''
      proc.stderr?.on('data', (data: Buffer) => { stderr += data.toString() })

      const timeout = setTimeout(() => {
        proc.kill()
        reject(new Error('TTS synthesis timed out (120s)'))
      }, 120000)

      proc.on('error', (err) => {
        clearTimeout(timeout)
        reject(new Error(`Failed to start llama-tts: ${err.message}\n${stderr}`))
      })

      proc.on('exit', (code) => {
        clearTimeout(timeout)
        this.process = null
        if (code !== 0) {
          reject(new Error(`llama-tts exited with code ${code}\nArgs: ${args.join('|')}\n${stderr}`))
          return
        }
        try {
          const wav = readFileSync(outFile)
          const base64 = wav.toString('base64')
          try { unlinkSync(outFile) } catch {}
          resolve(base64)
        } catch (err) {
          reject(new Error(`Failed to read output WAV: ${err}`))
        }
      })
    })
  }

  stop(): void {
    if (this.process) {
      this.process.kill()
      this.process = null
    }
  }

  private findLlamaTts(): string | null {
    const resourcesDir = (process as any).resourcesPath || join(__dirname, '..', '..')
    const candidates = [
      join(resourcesDir, 'bin', 'llama', 'llama-tts.exe'),
      join(__dirname, '..', '..', 'bin', 'llama', 'llama-tts.exe'),
    ]
    for (const p of candidates) {
      if (existsSync(p)) return p
    }
    return null
  }
}
