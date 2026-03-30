# Clockwork Raycast Extension

> Handoff from clockwork Session 2
> Date: 2026-03-30

---

## What This Is

A Raycast extension for managing clockwork projects across multiple repos. Provides visibility into all sessions, one-click navigation to the right app/terminal, and status at a glance.

---

## Core Requirements

### 1. Project Discovery

**NOT hardcoded paths.** Two modes:

**Mode A: Parent folder scan**
- User configures parent folder (e.g., `~/Documents/Antaxial`)
- Extension recursively scans for repos with `knowledge/SESSION-STATE*.md`
- Auto-discovers nested repos (e.g., intracalc contains frontend-system)

**Mode B: Manual add**
- User can also manually add specific project paths via Raycast preferences
- Projects persist in Raycast preferences

**Both modes can coexist.** Parent scan + manual additions.

### 2. State File Parsing

Scan each discovered project for:
- `knowledge/SESSION-STATE.md` (single-track or meta)
- `knowledge/SESSION-STATE-{TRACK}.md` (track-specific)
- `knowledge/RULES.md` (verification targets, vscode_path)

Parse YAML frontmatter:

```yaml
# SESSION-STATE*.md
---
project: my-project
track: web                    # optional
current_session: web-7
status: IN_PROGRESS           # READY|IN_PROGRESS|TO_VERIFY|BLOCKED|COMPLETE
blocked_by: web-6             # optional
last_updated: 2026-03-30
sessions:                     # optional, enables rich features
  web-7:
    status: IN_PROGRESS
    goal: Settings page
    verify_with: browser
  web-8:
    status: BLOCKED
    blocked_by: web-7
    goal: Profile page
    verify_with: browser
---
```

```yaml
# RULES.md
---
project: my-project
vscode_path: /Users/space/Documents/Antaxial/my-project

verification_targets:
  web:
    app: browser
    url: http://localhost:3000
  ios:
    app: xcode
    path: apps/ios/Project.xcworkspace
  android:
    app: android_studio
    path: apps/android
---
```

### 3. Display

**Main list view grouped by status:**

```
READY NOW (3)
  ● clockwork / Session 2
    Document patterns
    main · clean

  ● intracalc / ios-6
    Push notifications
    feature/push · dirty

  ● field-automation / web-4
    Dashboard polish
    main · clean

IN PROGRESS (1)
  ◐ intracalc / web-5
    Settings page
    feature/settings · dirty

TO VERIFY (1)
  ◑ field-automation / web-3
    Auth flow
    main · clean

BLOCKED (2)
  ○ intracalc / android-7
    Background sync
    ← waiting for ios-6

  ○ intracalc / functions-3
    API endpoints
    ← waiting for web-5
```

**Status indicators:**

| Status | Icon | Color |
|--------|------|-------|
| READY | ● | Green |
| IN_PROGRESS | ◐ | Blue |
| TO_VERIFY | ◑ | Yellow/Orange |
| BLOCKED | ○ | Gray |
| COMPLETE | ✓ | Dim (or hide) |

### 4. Git Integration

For each project, show:
- Current branch name
- Dirty/clean status

```bash
# Get branch
git -C /path/to/project rev-parse --abbrev-ref HEAD

# Get dirty status
git -C /path/to/project status --porcelain
# Empty = clean, non-empty = dirty
```

Display as: `main · clean` or `feature/auth · dirty`

### 5. Contextual Actions

**Actions are based on `verify_with` field.** Don't show irrelevant actions.

| verify_with | Actions |
|-------------|---------|
| `browser` | Open VS Code, Open Browser (url from verification_targets) |
| `xcode` | Open VS Code, Open Xcode (path from verification_targets) |
| `android_studio` | Open VS Code, Open Android Studio (path from verification_targets) |
| `null` / not set | Open VS Code only |

**Action commands:**

```bash
# VS Code
code /path/to/project

# Browser
open http://localhost:3000

# Xcode
open /path/to/Project.xcworkspace

# Android Studio
open -a "Android Studio" /path/to/android
```

**Keyboard shortcuts:**
- `↵` Enter: Open VS Code (default)
- `⌘O`: Open verification app (contextual)
- `⌘I`: Show detail view
- `⌘R`: Refresh

### 6. Detail View

When user presses `⌘I` or selects "Show Details":

```
┌─────────────────────────────────────────────────────────────┐
│ intracalc / ios-6                                           │
├─────────────────────────────────────────────────────────────┤
│ Status:      READY                                          │
│ Goal:        Push notifications                             │
│ Track:       ios                                            │
│ Branch:      feature/push                                   │
│ Git Status:  dirty (3 files)                                │
│                                                             │
│ Depends on:  ios-5 (COMPLETE)                               │
│ Unlocks:     android-7                                      │
│                                                             │
│ Verify with: Xcode                                          │
│ Workspace:   apps/ios/Intracalc.xcworkspace                 │
│                                                             │
│ [Open VS Code]  [Open Xcode]                                │
└─────────────────────────────────────────────────────────────┘
```

### 7. Preferences

Raycast extension preferences:

| Preference | Type | Description |
|------------|------|-------------|
| `scanFolders` | Text (comma-separated) | Parent folders to scan recursively |
| `additionalProjects` | Text (comma-separated) | Manual project paths to include |
| `showCompleted` | Boolean | Show COMPLETE sessions (default: false) |
| `refreshInterval` | Number | Auto-refresh interval in seconds (0 = manual only) |

---

## Tech Stack

- **Raycast SDK** (React + TypeScript)
- **YAML parsing**: `yaml` or `js-yaml` npm package
- **Git commands**: child_process exec

**Scaffold:**
```bash
npx create-raycast-extension
```

**Key Raycast components:**
- `List`, `List.Section`, `List.Item`
- `ActionPanel`, `Action`, `Action.Open`, `Action.Push`
- `Detail`
- `Icon`, `Color`
- `getPreferenceValues()`

---

## File Structure

```
clockwork-raycast/
├── src/
│   ├── index.tsx              # Main command
│   ├── scanner.ts             # Project discovery + parsing
│   ├── git.ts                 # Git commands
│   ├── types.ts               # TypeScript types
│   └── actions.ts             # Action helpers
├── package.json
├── tsconfig.json
└── README.md
```

---

## Schema Reference

Full frontmatter schema documented in:
- `../clockwork/METHODOLOGY.md` Section 16 (State File Structure)
- `../clockwork/templates/SESSION-STATE.md`
- `../clockwork/templates/RULES.md`

Reference implementation:
- `../clockwork/SESSION-STATE-DEV.md`

---

## Session Prompt

```
Build a Raycast extension for clockwork project management.

Read HANDOFF.md for full requirements.

Key points:
1. Auto-discover projects by scanning parent folders for knowledge/SESSION-STATE*.md
2. Parse YAML frontmatter from SESSION-STATE*.md and RULES.md
3. Display sessions grouped by status with git branch info
4. Contextual actions based on verify_with field (don't show Xcode for web sessions)
5. Preferences for scan folders and manual project additions

Use Raycast SDK: List, ActionPanel, Action.Open, Icon, Color, getPreferenceValues.
Parse YAML with js-yaml package.
Run git commands with child_process.

Start with: npx create-raycast-extension
```

---

## Notes

- **Clockwork submodule:** Will add when clockwork has remote repo. For now, reference schemas at `../clockwork/`
- **One session expected:** This is a small tool. Should complete in one session.
- **Private extension:** No need to publish to Raycast Store. Dev mode is fine.

---

*Handoff complete: 2026-03-30*
