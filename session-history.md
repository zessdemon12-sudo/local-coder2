# Local Coder — Session History

## Session 4 — Implementation of 21 Improvement Items

### Goal
Implement 21 out of 25 items from the 5-tier improvement plan across safety, UX, workflow, polish, and quality-of-life categories.

### Files Modified

| File | Change |
|------|--------|
| `src/main/ipc-handlers.ts` | Concurrent chat-send fix (`agent.stop()` before new), `model-disconnect` IPC, `approve-tool` IPC, `fetch-models` IPC, `update-workspace-dir` IPC |
| `src/main/agent-loop.ts` | Subagent depth limit (MAX_SUBAGENT_DEPTH=5), relative path relativize helper, approval-gated write_file/edit_file, pendingApproval state |
| `src/main/tools/registry.ts` | `isPathInsideWorkspace` guard on read_file/write_file/edit_file, setAllowOutsideWorkspace flag |
| `src/main/tools/bash-policy.ts` | **NEW** — command denylist (rm -rf, format, diskpart, etc.) + user-configurable regex blocklist |
| `src/main/index.ts` | F11 fullscreen toggle via `before-input-event` |
| `src/preload/index.ts` | Exposed `modelDisconnect`, `approveTool`, `updateWorkspaceDir`, `fetchModels` to renderer |
| `src/types/electron.d.ts` | Type declarations for new API methods |
| `src/renderer/src/App.tsx` | Theme class toggle effect, `tool_approval` event handling |
| `src/renderer/src/components/Sidebar.tsx` | Workspace "Change" button, health dot (green/yellow/red), token count display with color dots |
| `src/renderer/src/components/ChatInput.tsx` | Drag-and-drop file upload, fast input mode support |
| `src/renderer/src/components/ModelSetup.tsx` | "Fetch" model list button from API URL with click-to-select |
| `src/renderer/src/components/SettingsPanel.tsx` | Theme toggle (Dark/Light), Cache clear button, fast input toggle, MCP tool list per server |
| `src/renderer/src/components/ApprovalBar.tsx` | **NEW** — approve/reject UI for file write/edit operations |
| `src/renderer/src/store/chat-store.ts` | Added `inputTokens`, `outputTokens`, `totalTokens`, `theme`, `fastInput`, `pendingApproval` state |
| `src/renderer/src/styles/global.css` | Light theme CSS variables (`.light-theme`) |

### Builds
- `dist\Local Coder 1.0.0.exe` (portable)
- `dist\Local Coder Setup 1.0.0.exe` (installer)

### Not Implemented (4 of 25)
- **P3.1**: Auto-init model with cached config — skipped (risky)
- **P3.2**: Plan mode — skipped (needs full agent loop rework)
- **P4.5**: Asar packaging — deferred to P5 final build
- **P5.1**: Auto-update — needs npm install + GitHub publish setup
