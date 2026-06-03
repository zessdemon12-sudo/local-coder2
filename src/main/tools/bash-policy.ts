const DEFAULT_DENYLIST = [
  /rm\s+-rf\s+[/\\](?:$|\s)/i,
  /^\s*format\s+[a-z]:/i,
  /del\s+\/[fqs].*[\\]\*/i,
  /rd\s+\/s\s+\/q/i,
  /diskpart/i,
  /reg\s+delete/i,
  /bcdedit/i,
  /^\s*format\s/i,
]

let userDenylist: RegExp[] = []

export function setUserDenylist(patterns: string[]): void {
  userDenylist = patterns.map(p => {
    try { return new RegExp(p, 'i') } catch { return /(?!)  / }
  })
}

export function checkCommand(command: string): { safe: boolean; reason?: string } {
  for (const re of DEFAULT_DENYLIST) {
    if (re.test(command)) {
      return { safe: false, reason: `Command matches blocked pattern: ${re}` }
    }
  }
  for (const re of userDenylist) {
    if (re.test(command)) {
      return { safe: false, reason: `Command matches user blocklist pattern: ${re}` }
    }
  }
  return { safe: true }
}
