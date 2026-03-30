---
project: clockwork-raycast
vscode_path: /Users/space/Documents/Antaxial/clockwork-raycast
---

# Project Rules: clockwork-raycast

---

## Build Commands

| Command | When | Directory |
|---------|------|-----------|
| `npm install` | After clone | root |
| `npm run dev` | Development (Raycast hot reload) | root |
| `npm run build` | Production build | root |
| `npm run lint` | Before commit | root |

---

## Tech Stack

- Raycast SDK (React + TypeScript)
- js-yaml (YAML parsing)
- Node.js child_process (git commands)

---

## File Ownership

Single developer, no tracks. All files owned.

---

## References

| Reference | Purpose |
|-----------|---------|
| `../clockwork/METHODOLOGY.md` Section 16 | Frontmatter schema |
| `../clockwork/templates/SESSION-STATE.md` | State file template |
| `../clockwork/templates/RULES.md` | Rules template |
| `../clockwork/SESSION-STATE-DEV.md` | Reference implementation |

---

## Conventions

- Follow Raycast extension guidelines
- Use TypeScript strict mode
- Keep components small and focused
