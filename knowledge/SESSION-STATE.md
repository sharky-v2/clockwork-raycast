---
project: clockwork-raycast
current_session: 2
status: READY
last_updated: 2026-03-31
sessions:
  1:
    status: TO_VERIFY
    goal: Build Raycast extension for clockwork project management
    verify_with: build
  2:
    status: READY
    goal: Fix live detection, polish UI, consider Claude Code hooks
    verify_with: build
---

# State: CLOCKWORK-RAYCAST

> **Current Session:** 2 | **Status:** READY
> **Last Updated:** 2026-03-31

---

## Handoff: 1 → 2

### What Session 1 Built
- Raycast extension with project discovery, SESSION-STATE parsing
- Live claude session detection via `pgrep`/`lsof`
- Contextual primary actions (browser/xcode/android_studio)
- Semantic badges, detail panel layout

### What's NOT Working
- **Live detection inconsistent** - User still not seeing all sessions in Raycast
- Detection works in terminal but may fail in Raycast sandbox
- Need to verify `pgrep -f "/claude|^claude"` works in Raycast env

### What Needs Session 2
1. Debug why live detection fails in Raycast (permissions? sandbox?)
2. Consider Claude Code hooks for proper registration (see PROPOSAL-LIVE-SESSIONS.md)
3. Polish detail panel - user wanted leaner, better formatted
4. Test all verification flows

### Files to Read
- `src/browse-sessions.tsx` - Main component, live detection at line ~30
- `knowledge/PROPOSAL-LIVE-SESSIONS.md` - Hook-based solution design

### Key Decisions Made
| ID | Decision |
|----|----------|
| D9 | Lenient parsing (markdown fallback) |
| D10 | No auto-scan, explicit add only |
| D11 | Live detection via pgrep/lsof |
| D12 | "Live (not added)" section for discovery |
| D13 | Contextual primary action |

---

## Session 1 Summary

**Date:** 2026-03-30 to 2026-03-31
**Status:** TO_VERIFY

Built complete extension but live session detection needs debugging in Raycast environment.

---

## Learnings

| ID | Learning | Root Cause |
|----|----------|------------|
| L1 | Must follow clockwork even for clockwork tooling | Started without protocol |
| L2 | Auto-scan is perf disaster | Would freeze Raycast |
| L3 | Tooling must match methodology reality | Built strict parser, real files are flexible |
| L4 | ps/pgrep patterns differ | Full path vs basename |
| L5 | Raycast may sandbox shell commands | Need to verify |
| L6 | EXIT BEFORE AUTOCOMPACT | Almost violated this |

---

*Session 1 ended due to token budget. Clean handoff.*
