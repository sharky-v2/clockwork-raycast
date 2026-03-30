---
project: clockwork-raycast
current_session: 1
status: READY
last_updated: 2026-03-30
sessions:
  1:
    status: READY
    goal: Build Raycast extension for clockwork project management
    verify_with: null
---

# State: CLOCKWORK-RAYCAST

> **Current Session:** 1 | **Status:** READY
> **Last Updated:** 2026-03-30

---

## Overview

Raycast extension for managing clockwork projects. Provides visibility across all projects, one-click navigation, and status at a glance.

---

## Session 1: Build Extension

**Goal:** Complete Raycast extension per HANDOFF.md requirements.

**Scope:**
- Project discovery (parent folder scan + manual add)
- State file parsing (YAML frontmatter)
- List view grouped by status
- Git integration (branch, dirty/clean)
- Contextual actions (based on verify_with)
- Preferences UI

**Expected:** One session to complete.

---

## Decisions

| ID | Decision | Rationale | Session |
|----|----------|-----------|---------|
| D1 | Use clockwork-lite (not full ceremony) | Small tool, one session expected | 0 |
| D2 | Reference clockwork schemas, no submodule yet | Clockwork lacks remote repo currently | 0 |

---

## Learnings

*(To be filled during development)*
