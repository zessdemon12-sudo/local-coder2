# Local Coder — Session History

## Session 4 — Full Implementation of 21 Improvement Items

### Overview
Implemented 21 of 25 planned improvements across 5 priority tiers. Build verified and packaged into portable + installer exes.

### Tier 1 — Core Safety (P1)

| # | Item | Files Changed |
|---|------|-------------|
| 1.1 | Concurrent chat-send race fix | `src/main/ipc-handlers.ts` — call `agent.stop()` before creating new AgentLoop |
| 1.2 | Workspace path validation | `src/main/tools/registry.ts` — `isPathInsideWorkspace()` guard on all file tools |
| 1.3 | Bash command sandbox | `src/main/tools/bash-policy.ts` — **NEW** denylist (rm -rf, format, diskpart) + user regex support |
| 1.4 | System prompt guard order | `src/main/agent-loop.ts` — removed stale SYSTEM_PROMPT, clean injection at start |
| — | model-disconnect IPC | `src/main/ipc-handlers.ts` — separated from chat-reset, disposes engine |

### Tier 2 — UX Improvements (P2)

| # | Item | Details |
|---|------|---------|
| 2.1 | Sidebar improvements | Workspace "Change" button, health dot (green/yellow/red), token count display |
| 2.2 | Model list discovery | `fetchModels` IPC handler + "Fetch" button in ModelSetup, click-to-select |
| 2.3/2.4 | Token tracking | `inputTokens`, `outputTokens`, `totalTokens` in Zustand store + IPC relay |
| 2.5 | Drag-and-drop upload | `onDrop` handler in ChatInput, handles images + documents, highlight on dragover |

### Tier 3 — Workflow Safety (P3)

| # | Item | Details |
|---|------|---------|
| 3.3 | Diff preview before write | `tool_approval` event pauses agent loop, ApprovalBar shows Approve/Reject buttons |
| 3.4 | Confirm tool | Approval-gated `write_file`/`edit_file` — agent waits for user decision |
| 3.5 | Subagent depth limit | `MAX_SUBAGENT_DEPTH = 5` with `currentDepth` counter, error on overflow |
| 3.6 | Relative paths | `relativizeResult()` strips workspace prefix from tool result paths |

### Tier 4 — Polish (P4)

| # | Item | Details |
|---|------|---------|
| 4.1 | Theme toggle | Dark/Light mode toggle in Settings, `.light-theme` CSS class on `:root` |
| 4.2 | Cache indicators | "Clear all cache & reload" button in Settings |
| 4.3 | Model list from API | Fetch button in ModelSetup queries `/models` endpoint, shows clickable list |
| 4.4 | Sidebar health badge | Color-coded dot — Connected (green), Connecting (yellow), Error (red), Disconnected (gray) |

### Tier 5 — Quality of Life (P5)

| # | Item | Details |
|---|------|---------|
| 5.2 | Fast input mode | Toggle in Settings — Enter sends without Shift |
| 5.3 | Fullscreen toggle | F11 key handler in `src/main/index.ts` |
| 5.4 | Improved MCP UI | Tool list per server with status dot, tool count, description |
| 5.5 | Color tokens | Blue dot for input tokens, green dot for output tokens in sidebar |

### Skipped Items (4)
- **P3.1**: Auto-init model with cached config (too risky)
- **P3.2**: Plan mode (needs full agent loop rework)
- **P4.5**: Asar packaging (deferred to final build)
- **P5.1**: Auto-update (needs npm install + GitHub publish config)

### Git Commit
```
5e91218 — Session 4: 21 improvement items — safety, UX, workflow, polish, QoL
17 files changed, 857 insertions(+), 60 deletions(-)
```

### Build Outputs
- `dist\Local Coder 1.0.0.exe` (portable)
- `dist\Local Coder Setup 1.0.0.exe` (installer)
