import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'

export interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
  execute: (args: Record<string, unknown>) => Promise<ToolResult>
}

export const toolRegistry: ToolDefinition[] = [
  {
    name: 'read_file',
    description: 'Read the contents of a file',
    parameters: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Absolute path to the file' }
      },
      required: ['filePath']
    },
    execute: async (args) => {
      try {
        const content = await fs.readFile(args.filePath as string, 'utf-8')
        return { success: true, data: content }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  },
  {
    name: 'write_file',
    description: 'Write content to a file (overwrites existing)',
    parameters: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Absolute path to the file' },
        content: { type: 'string', description: 'Content to write' }
      },
      required: ['filePath', 'content']
    },
    execute: async (args) => {
      try {
        const dir = path.dirname(args.filePath as string)
        await fs.mkdir(dir, { recursive: true })
        await fs.writeFile(args.filePath as string, args.content as string, 'utf-8')
        return { success: true, data: 'File written successfully' }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  },
  {
    name: 'edit_file',
    description: 'Apply a search/replace edit to a file',
    parameters: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Absolute path to the file' },
        oldString: { type: 'string', description: 'Text to replace' },
        newString: { type: 'string', description: 'Replacement text' }
      },
      required: ['filePath', 'oldString', 'newString']
    },
    execute: async (args) => {
      try {
        const content = await fs.readFile(args.filePath as string, 'utf-8')
        const oldStr = args.oldString as string
        const newStr = args.newString as string
        if (!content.includes(oldStr)) {
          return { success: false, error: 'oldString not found in file' }
        }
        const result = content.replace(oldStr, newStr)
        await fs.writeFile(args.filePath as string, result, 'utf-8')
        return { success: true, data: 'File edited successfully' }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  },
  {
    name: 'bash',
    description: 'Execute a bash/shell command',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Command to execute' },
        workdir: { type: 'string', description: 'Working directory (optional)' }
      },
      required: ['command']
    },
    execute: async (args) => {
      try {
        const opts: Record<string, unknown> = {
          encoding: 'utf-8',
          maxBuffer: 10 * 1024 * 1024,
          timeout: 30000
        }
        if (args.workdir) opts.cwd = args.workdir
        const output = execSync(args.command as string, opts)
        return { success: true, data: output }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  },
  {
    name: 'glob',
    description: 'Find files matching a pattern using dir /s',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Filename pattern (e.g. *.ts, *.py)' },
        rootDir: { type: 'string', description: 'Root directory to search from (optional)' }
      },
      required: ['pattern']
    },
    execute: async (args) => {
      try {
        const root = (args.rootDir as string) || process.cwd()
        const pattern = args.pattern as string
        const results = execSync(
          `dir /s /b "${pattern}" 2>nul`,
          { cwd: root, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
        )
        const files = results.split('\r\n').filter(Boolean)
        return { success: true, data: files }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  },
  {
    name: 'grep',
    description: 'Search for text in files using findstr',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Text pattern to search for' },
        include: { type: 'string', description: 'File pattern filter (e.g. *.ts) (optional)' },
        rootDir: { type: 'string', description: 'Root directory (optional)' }
      },
      required: ['pattern']
    },
    execute: async (args) => {
      try {
        const root = (args.rootDir as string) || process.cwd()
        const include = (args.include as string) || '*.*'
        const pattern = args.pattern as string
        const results = execSync(
          `findstr /s /n /i /c:"${pattern}" "${include}" 2>nul`,
          { cwd: root, encoding: 'utf-8', maxBuffer: 5 * 1024 * 1024, timeout: 10000 }
        )
        const lines = results.split('\r\n').filter(Boolean)
        return { success: true, data: lines.length > 0 ? lines : 'No matches found' }
      } catch (err: unknown) {
        const msg = String(err)
        if (msg.includes('timed out')) return { success: false, error: 'Search timed out' }
        return { success: true, data: 'No matches found' }
      }
    }
  },
  {
    name: 'list_directory',
    description: 'List files and directories in a path',
    parameters: {
      type: 'object',
      properties: {
        dirPath: { type: 'string', description: 'Absolute path to the directory' }
      },
      required: ['dirPath']
    },
    execute: async (args) => {
      try {
        const entries = await fs.readdir(args.dirPath as string, { withFileTypes: true })
        const listing = entries.map(e => ({
          name: e.name,
          type: e.isDirectory() ? 'directory' : 'file',
          size: e.isFile() ? 0 : undefined
        }))
        for (const item of listing) {
          if (item.type === 'file') {
            try {
              const stat = await fs.stat(path.join(args.dirPath as string, item.name))
              item.size = stat.size
            } catch { }
          }
        }
        return { success: true, data: listing }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  }
]
