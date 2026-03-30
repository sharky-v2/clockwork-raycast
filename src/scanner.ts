import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { homedir } from "os";
import { basename, join } from "path";
import * as yaml from "js-yaml";
import { getGitInfo, isGitRepo } from "./git";
import {
  ClockworkProject,
  RulesFrontmatter,
  Session,
  SessionStatus,
  StateFrontmatter,
} from "./types";

const MAX_DEPTH = 5;

function expandPath(p: string): string {
  if (p.startsWith("~")) {
    return join(homedir(), p.slice(1));
  }
  return p;
}

function parseFrontmatter<T>(content: string): T | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  try {
    return yaml.load(match[1]) as T;
  } catch {
    return null;
  }
}

function findSessionFiles(knowledgeDir: string): string[] {
  if (!existsSync(knowledgeDir)) return [];
  try {
    return readdirSync(knowledgeDir).filter(
      (f) => f.startsWith("SESSION-STATE") && f.endsWith(".md")
    );
  } catch {
    return [];
  }
}

function parseStateFile(filePath: string, projectPath: string, projectName: string, projectGit: ReturnType<typeof getGitInfo>): Session[] {
  const sessions: Session[] = [];

  try {
    const content = readFileSync(filePath, "utf-8");
    const frontmatter = parseFrontmatter<StateFrontmatter>(content);

    if (!frontmatter || !frontmatter.project) {
      return sessions;
    }

    // Extract track from filename if present (SESSION-STATE-WEB.md -> WEB)
    const filename = basename(filePath);
    let track: string | undefined;
    const trackMatch = filename.match(/^SESSION-STATE-(.+)\.md$/);
    if (trackMatch) {
      track = trackMatch[1].toLowerCase();
    }
    track = track || frontmatter.track;

    // If sessions map exists, use it for rich data
    if (frontmatter.sessions && typeof frontmatter.sessions === "object") {
      for (const [sessionId, info] of Object.entries(frontmatter.sessions)) {
        if (info && typeof info === "object") {
          sessions.push({
            id: String(sessionId),
            projectPath,
            projectName,
            track,
            filePath,
            status: info.status || frontmatter.status,
            goal: info.goal,
            verify_with: info.verify_with,
            blocked_by: info.blocked_by,
            git: projectGit,
          });
        }
      }
    } else {
      // Fallback: create single session from frontmatter
      sessions.push({
        id: String(frontmatter.current_session),
        projectPath,
        projectName,
        track,
        filePath,
        status: frontmatter.status,
        goal: undefined,
        verify_with: undefined,
        blocked_by: frontmatter.blocked_by,
        git: projectGit,
      });
    }
  } catch {
    // Ignore unreadable files
  }

  return sessions;
}

function scanDirectory(
  dir: string,
  depth: number,
  projects: ClockworkProject[]
): void {
  if (depth > MAX_DEPTH) return;
  if (!existsSync(dir)) return;

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  // Check if this directory has a knowledge/ folder with SESSION-STATE*.md
  const knowledgeDir = join(dir, "knowledge");
  const sessionFiles = findSessionFiles(knowledgeDir);

  if (sessionFiles.length > 0 && isGitRepo(dir)) {
    const projectGit = getGitInfo(dir);
    const projectName = basename(dir);

    // Parse RULES.md if present
    let rules: RulesFrontmatter | undefined;
    const rulesPath = join(knowledgeDir, "RULES.md");
    if (existsSync(rulesPath)) {
      try {
        const rulesContent = readFileSync(rulesPath, "utf-8");
        rules = parseFrontmatter<RulesFrontmatter>(rulesContent) ?? undefined;
      } catch {
        // Ignore
      }
    }

    // Parse all session files
    const sessions: Session[] = [];
    for (const sessionFile of sessionFiles) {
      const filePath = join(knowledgeDir, sessionFile);
      const fileSessions = parseStateFile(filePath, dir, projectName, projectGit);
      sessions.push(...fileSessions);
    }

    if (sessions.length > 0) {
      projects.push({
        path: dir,
        name: projectName,
        rules,
        sessions,
        git: projectGit,
      });
    }
  }

  // Recurse into subdirectories
  for (const entry of entries) {
    if (entry.startsWith(".") || entry === "node_modules") continue;
    const fullPath = join(dir, entry);
    try {
      if (statSync(fullPath).isDirectory()) {
        scanDirectory(fullPath, depth + 1, projects);
      }
    } catch {
      // Skip inaccessible directories
    }
  }
}

export function discoverProjects(
  scanFolders: string[],
  additionalProjects: string[]
): ClockworkProject[] {
  const projects: ClockworkProject[] = [];
  const seenPaths = new Set<string>();

  // Scan folders
  for (const folder of scanFolders) {
    const expanded = expandPath(folder.trim());
    if (expanded && existsSync(expanded)) {
      scanDirectory(expanded, 0, projects);
    }
  }

  // Mark seen paths
  for (const p of projects) {
    seenPaths.add(p.path);
  }

  // Add additional projects directly
  for (const projectPath of additionalProjects) {
    const expanded = expandPath(projectPath.trim());
    if (!expanded || seenPaths.has(expanded)) continue;
    if (!existsSync(expanded) || !isGitRepo(expanded)) continue;

    const knowledgeDir = join(expanded, "knowledge");
    const sessionFiles = findSessionFiles(knowledgeDir);
    if (sessionFiles.length === 0) continue;

    const projectGit = getGitInfo(expanded);
    const projectName = basename(expanded);

    let rules: RulesFrontmatter | undefined;
    const rulesPath = join(knowledgeDir, "RULES.md");
    if (existsSync(rulesPath)) {
      try {
        const rulesContent = readFileSync(rulesPath, "utf-8");
        rules = parseFrontmatter<RulesFrontmatter>(rulesContent) ?? undefined;
      } catch {
        // Ignore
      }
    }

    const sessions: Session[] = [];
    for (const sessionFile of sessionFiles) {
      const filePath = join(knowledgeDir, sessionFile);
      const fileSessions = parseStateFile(filePath, expanded, projectName, projectGit);
      sessions.push(...fileSessions);
    }

    if (sessions.length > 0) {
      projects.push({
        path: expanded,
        name: projectName,
        rules,
        sessions,
        git: projectGit,
      });
      seenPaths.add(expanded);
    }
  }

  return projects;
}
