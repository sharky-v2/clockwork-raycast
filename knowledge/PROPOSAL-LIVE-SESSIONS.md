# Proposal: Live Session Registration

## Problem

Raycast extension cannot reliably detect running Claude Code sessions because:
1. Process detection (`ps`/`lsof`) finds processes but can't map to session context
2. VS Code terminals don't expose which tab is which
3. No way to bring specific terminal to front

## Proposed Solution: Session Registry

Claude Code sessions register themselves on start, deregister on exit.

### Option A: File-based Registry (Simplest)

On session start, Claude Code writes:
```
~/.clockwork/live/{project-hash}.json
```

```json
{
  "project": "/Users/space/Documents/Antaxial/we-shape",
  "session_id": "Ideation-1",
  "started": "2026-03-30T18:00:00Z",
  "pid": 54580,
  "terminal": "vscode"
}
```

On session exit (or crash detection), file is removed.

### Implementation via Claude Code Hook

In `~/.claude/settings.json`:
```json
{
  "hooks": {
    "session_start": "~/.clockwork/hooks/register-session.sh",
    "session_end": "~/.clockwork/hooks/deregister-session.sh"
  }
}
```

### What This Enables

| Feature | Before | After |
|---------|--------|-------|
| Know which sessions are live | Process exists | Full session context |
| Session ID in tooling | No | Yes |
| Multiple sessions same project | "2 LIVE" | "Ideation-1, Ideation-2" |
| Stale detection | No | Yes (compare started time) |

## Effort Estimate

| Component | Effort |
|-----------|--------|
| Hook scripts | 1 hour |
| Raycast extension update | 1 hour |
| Testing | 1 hour |

## Decision Needed

Does Claude Code support hooks for session start/end?
- If yes: Implement this
- If no: Propose feature to Claude Code team

## Alternative: Wrapper Script

If hooks not available, wrap claude invocation:

```bash
#!/bin/bash
# ~/.local/bin/cw (clockwork-aware claude)
register_session "$PWD"
trap 'deregister_session "$PWD"' EXIT
claude "$@"
```

User invokes `cw` instead of `claude`. Less elegant but works.
