import initSqlJs, { Database as SqlJsDatabase } from 'sql.js'

interface Session {
  id: number
  name: string
  modelName: string
  messages: string
  createdAt: number
  updatedAt: number
}

export class SessionManager {
  private db: SqlJsDatabase | null = null

  async initialize(): Promise<void> {
    const SQL = await initSqlJs()
    this.db = new SQL.Database()
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        model_name TEXT,
        messages TEXT DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `)
  }

  getSessions(): Session[] {
    if (!this.db) return []
    const results = this.db.exec('SELECT * FROM sessions ORDER BY updated_at DESC')
    if (results.length === 0) return []
    return results[0].values.map(row => ({
      id: row[0] as number,
      name: row[1] as string,
      modelName: row[2] as string,
      messages: row[3] as string,
      createdAt: row[4] as number,
      updatedAt: row[5] as number
    }))
  }

  createSession(name: string, modelName: string): number {
    if (!this.db) return -1
    const now = Date.now()
    this.db.run(
      'INSERT INTO sessions (name, model_name, messages, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [name, modelName, '[]', now, now]
    )
    return (this.db.exec('SELECT last_insert_rowid()')[0].values[0][0] as number)
  }

  updateSession(id: number, messages: string): void {
    if (!this.db) return
    this.db.run(
      'UPDATE sessions SET messages = ?, updated_at = ? WHERE id = ?',
      [messages, Date.now(), id]
    )
  }

  deleteSession(id: number): void {
    if (!this.db) return
    this.db.run('DELETE FROM sessions WHERE id = ?', [id])
  }

  getSetting(key: string): string | null {
    if (!this.db) return null
    const results = this.db.exec('SELECT value FROM settings WHERE key = ?', [key])
    if (results.length === 0 || results[0].values.length === 0) return null
    return results[0].values[0][0] as string
  }

  setSetting(key: string, value: string): void {
    if (!this.db) return
    this.db.run(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [key, value]
    )
  }

  exportDb(): Uint8Array {
    if (!this.db) return new Uint8Array()
    return this.db.export()
  }
}
