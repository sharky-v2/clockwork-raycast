# Clockwork for Raycast

A Raycast extension for managing [Clockwork](https://github.com/sharky-v2/clockwork) project sessions across your codebase.

## Features

- **Browse Sessions**: View all sessions across multiple projects with status indicators
- **Multiple Views**: Group sessions by project, track, or status
- **Smart Unblocking**: See when blocked sessions become actionable (blocker is complete/verified)
- **Quick Actions**: Open in your editor, terminal, Finder, or edit session files directly
- **Rich Details**: View session goals, dependencies, progress, and git status

## Installation

1. Install [Raycast](https://raycast.com)
2. Clone this repository
3. Run `npm install && npm run dev` to start development mode
4. The extension will appear in Raycast

## Usage

### Adding Projects

1. Open Raycast and search for "Clockwork"
2. Use the "Add Project" action to select a folder containing a `.clockwork/` directory

### Session Statuses

| Status | Description |
|--------|-------------|
| Ready | Session is ready to start |
| In Progress | Currently being worked on |
| To Verify | Implementation complete, needs verification |
| Blocked | Waiting on another session |
| Complete | Done |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Primary action (open editor or verification target) |
| `Cmd + E` | Open in editor |
| `Cmd + O` | Edit session file |
| `Cmd + T` | Open terminal |
| `Cmd + Shift + F` | Show in Finder |
| `Cmd + R` | Refresh |

## Preferences

- **Default Editor**: Choose between VS Code, Cursor, Zed, or Sublime Text
- **Show Completed**: Toggle visibility of completed sessions

## Requirements

- macOS
- [Raycast](https://raycast.com)
- Projects using the [Clockwork](https://github.com/sharky-v2/clockwork) session format

## License

MIT
