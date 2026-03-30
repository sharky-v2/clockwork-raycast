---
project: clockwork-raycast
current_session: 1
status: TO_VERIFY
last_updated: 2026-03-31
sessions:
  1:
    status: TO_VERIFY
    goal: Build Raycast extension for clockwork project management
    verify_with: build
---

# State: CLOCKWORK-RAYCAST

> **Current Session:** 1 | **Status:** TO_VERIFY
> **Last Updated:** 2026-03-31

---

## Session 1 Summary

**Built complete Raycast extension for clockwork project management.**

### Completed

1. **Project discovery** - Folder picker, LocalStorage persistence
2. **SESSION-STATE parsing** - YAML frontmatter + fallback markdown parsing
3. **Live session detection** - `ps`/`lsof` to find running claude processes
4. **Contextual actions** - Primary action based on verify_with (browser/xcode/android_studio)
5. **Detail panel** - Lean layout with semantic badges
6. **Two sections**: "Live (not added)" for discovered sessions, "Live" for tracked ones

### Key Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1-D8 | See previous entries | - |
| D9 | Lenient parsing | Extract from markdown when no frontmatter |
| D10 | No auto-scanning | Explicit add only, no perf issues |
| D11 | Live detection via ps/lsof | Find claude processes by cwd |
| D12 | Show untracked live sessions | "Live (not added)" section for discoverability |
| D13 | Contextual primary action | verify_with determines Enter action |

### Verification Checklist

- [ ] "Live (not added)" shows running claude sessions not in extension
- [ ] "Live" shows tracked projects with active sessions
- [ ] Green `X live` badge on live items
- [ ] Orange `X` badge for uncommitted changes
- [ ] Enter on browser session opens browser
- [ ] Enter on xcode session opens Xcode
- [ ] Detail panel shows goal, branch, status without overflow

### Files

| File | Purpose |
|------|---------|
| `src/browse-sessions.tsx` | Main list with live detection |
| `src/manage-projects.tsx` | Project management |
| `src/scanner.ts` | Lenient parsing, verification targets |
| `src/types.ts` | TypeScript interfaces |
| `src/git.ts` | Git status |

---

## Handoff: 1 → 2

### What's Working
- Extension loads projects, shows sessions grouped by status
- Live claude sessions detected and shown in dedicated section
- Contextual actions based on verify_with

### Known Limitations
- Can't switch to specific VS Code terminal (no API)
- Live detection finds process but not session context (would need Claude Code hooks)

### Future Work (Session 2+)
1. Claude Code hooks for proper session registration
2. Polish detail panel styling
3. Keyboard navigation optimization
4. Auto-refresh on interval

### To Test
Run `npm run dev`, add your projects, verify live sessions appear.

---

## Learnings

| ID | Learning | Session |
|----|----------|---------|
| L1-L5 | See previous | 1 |
| L6 | Show discovered sessions even if not added | Helps user see what's running | 1 |
| L7 | ps -eo pid,comm more reliable than ps aux grep | Cleaner process matching | 1 |

---

*Session 1 complete. Awaiting verification.*
