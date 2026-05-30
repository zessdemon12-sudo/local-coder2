import { modelEngine } from './model-engine'

const MODEL_CACHE_KEY = 'local-coder-model-cache'

interface ModelCacheEntry {
  path: string
  name: string
  size: number
  lastUsed: number
}

export class ModelDownloader {
  private cache: ModelCacheEntry[] = []

  constructor() {
    this.loadCache()
  }

  private loadCache(): void {
    try {
      const data = localStorage.getItem(MODEL_CACHE_KEY)
      if (data) this.cache = JSON.parse(data)
    } catch { this.cache = [] }
  }

  private saveCache(): void {
    localStorage.setItem(MODEL_CACHE_KEY, JSON.stringify(this.cache))
  }

  getRecentModels(): ModelCacheEntry[] {
    return this.cache.sort((a, b) => b.lastUsed - a.lastUsed)
  }

  addToCache(path: string, name: string, size: number): void {
    this.cache = this.cache.filter(m => m.path !== path)
    this.cache.push({ path, name, size, lastUsed: Date.now() })
    this.saveCache()
  }

  async searchHuggingFace(query: string): Promise<Array<{ id: string; downloads: number; likes: number }>> {
    const url = `https://huggingface.co/api/models?search=${encodeURIComponent(query)}&library=gguf&sort=downloads&direction=-1&limit=20`
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HuggingFace API error: ${response.status}`)
    const models = await response.json() as Array<Record<string, unknown>>
    return models.map((m: Record<string, unknown>) => ({
      id: m.id as string,
      downloads: (m.downloads as number) || 0,
      likes: (m.likes as number) || 0
    }))
  }

  async listModelFiles(repoId: string): Promise<Array<{ name: string; size: number; downloadUrl: string }>> {
    const url = `https://huggingface.co/api/models/${repoId}/tree/main`
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Failed to list files: ${response.status}`)
    const files = await response.json() as Array<Record<string, unknown>>
    return files
      .filter((f: Record<string, unknown>) => (f.rfilename as string || '').endsWith('.gguf'))
      .map((f: Record<string, unknown>) => {
        const name = f.rfilename as string
        return {
          name,
          size: (f.size as number) || 0,
          downloadUrl: `https://huggingface.co/${repoId}/resolve/main/${name}`
        }
      })
  }
}
