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

export function expandPath(p: string): string {
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

/**
 * Parse session info from markdown content when frontmatter is missing.
 * Handles real-world clockwork files that don't have YAML frontmatter.
 */
function parseFromMarkdown(
  content: string,
  filePath: string,
): Partial<StateFrontmatter> | null {
  const result: Partial<StateFrontmatter> = {};

  // Extract project name from:
  // "# Session State: we-shape" or "# State: PROJECT" or "# State: PROJECT-NAME"
  const projectMatch = content.match(/^#\s*(?:Session\s+)?State:\s*(.+?)$/im);
  if (projectMatch) {
    result.project = projectMatch[1].trim();
  }

  // Extract session from:
  // "> **Session:** Ideation-1" or "> **Current Session:** 5"
  const sessionMatch = content.match(
    />\s*\*\*(?:Current\s+)?Session:\*\*\s*(.+?)(?:\s*\||\s*$)/im,
  );
  if (sessionMatch) {
    result.current_session = sessionMatch[1].trim();
  }

  // Extract status from:
  // "> **Status:** IN_PROGRESS" or "| **Status:** READY"
  const statusMatch = content.match(/\*\*Status:\*\*\s*([A-Z_]+)/i);
  if (statusMatch) {
    const rawStatus = statusMatch[1].toUpperCase().trim();
    // Normalize status values
    const statusMap: Record<string, SessionStatus> = {
      READY: "READY",
      IN_PROGRESS: "IN_PROGRESS",
      "IN PROGRESS": "IN_PROGRESS",
      INPROGRESS: "IN_PROGRESS",
      TO_VERIFY: "TO_VERIFY",
      "TO VERIFY": "TO_VERIFY",
      TOVERIFY: "TO_VERIFY",
      BLOCKED: "BLOCKED",
      COMPLETE: "COMPLETE",
      COMPLETED: "COMPLETE",
      DONE: "COMPLETE",
      HANDOFF: "TO_VERIFY", // Treat HANDOFF as TO_VERIFY
    };
    result.status = statusMap[rawStatus] || "IN_PROGRESS";
  }

  // Extract goal from:
  // "**Goal:** Build something" or "> **Goal:** Build something"
  const goalMatch = content.match(/\*\*Goal:\*\*\s*(.+?)$/im);

  // If we found at least project or session, return what we have
  if (result.project || result.current_session) {
    // Build sessions map if we have session info
    if (result.current_session) {
      result.sessions = {
        [result.current_session]: {
          status: result.status || "IN_PROGRESS",
          goal: goalMatch ? goalMatch[1].trim() : undefined,
        },
      };
    }
    return result;
  }

  return null;
}

function findSessionStateFiles(dir: string): string[] {
  const files: string[] = [];

  // Check knowledge/ directory (standard location)
  const knowledgeDir = join(dir, "knowledge");
  if (existsSync(knowledgeDir)) {
    try {
      const knowledgeFiles = readdirSync(knowledgeDir)
        .filter((f) => f.startsWith("SESSION-STATE") && f.endsWith(".md"))
        .map((f) => join(knowledgeDir, f));
      files.push(...knowledgeFiles);
    } catch {
      // Permission denied or other error
    }
  }

  // Also check root directory (some projects have it there)
  try {
    const rootFiles = readdirSync(dir)
      .filter((f) => f.startsWith("SESSION-STATE") && f.endsWith(".md"))
      .map((f) => join(dir, f));
    files.push(...rootFiles);
  } catch {
    // Permission denied or other error
  }

  return files;
}

function parseStateFile(
  filePath: string,
  projectPath: string,
  projectName: string,
  projectGit: ReturnType<typeof getGitInfo>,
): Session[] {
  const sessions: Session[] = [];

  try {
    const content = readFileSync(filePath, "utf-8");

    // Try YAML frontmatter first
    let frontmatter = parseFrontmatter<StateFrontmatter>(content);

    // Fall back to markdown parsing if no frontmatter
    if (!frontmatter || !frontmatter.project) {
      const parsed = parseFromMarkdown(content, filePath);
      if (parsed) {
        frontmatter = {
          project: parsed.project || projectName,
          current_session: parsed.current_session || "1",
          status: parsed.status || "IN_PROGRESS",
          sessions: parsed.sessions,
        } as StateFrontmatter;
      }
    }

    if (!frontmatter) {
      return sessions;
    }

    // Extract track from filename (SESSION-STATE-WEB.md -> web)
    const filename = basename(filePath);
    let track: string | undefined;
    const trackMatch = filename.match(/^SESSION-STATE-(.+)\.md$/);
    if (trackMatch) {
      track = trackMatch[1].toLowerCase();
    }
    track = frontmatter.track || track;

    // If sessions map exists, use it for rich data
    if (frontmatter.sessions && typeof frontmatter.sessions === "object") {
      for (const [sessionId, info] of Object.entries(frontmatter.sessions)) {
        if (info && typeof info === "object") {
          sessions.push({
            id: String(sessionId),
            projectPath,
            projectName: frontmatter.project || projectName,
            track,
            filePath,
            status: info.status || frontmatter.status || "IN_PROGRESS",
            goal: info.goal,
            verify_with: info.verify_with,
            blocked_by: info.blocked_by,
            git: projectGit,
          });
        }
      }
    } else {
      // Single session from frontmatter
      sessions.push({
        id: String(frontmatter.current_session || "1"),
        projectPath,
        projectName: frontmatter.project || projectName,
        track,
        filePath,
        status: frontmatter.status || "IN_PROGRESS",
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

/**
 * Load projects from explicit paths only.
 * No recursive scanning. Each path is checked directly.
 */
export function loadProjects(projectPaths: string[]): ClockworkProject[] {
  const projects: ClockworkProject[] = [];
  const seen = new Set<string>();

  for (const p of projectPaths) {
    const path = expandPath(p.trim());
    if (!path || seen.has(path)) continue;
    if (!existsSync(path)) continue;

    try {
      if (!statSync(path).isDirectory()) continue;
    } catch {
      continue;
    }

    const sessionFiles = findSessionStateFiles(path);
    if (sessionFiles.length === 0) continue;
    if (!isGitRepo(path)) continue;

    seen.add(path);
    const projectGit = getGitInfo(path);
    const projectName = basename(path);

    // Parse RULES.md if present
    let rules: RulesFrontmatter | undefined;
    const rulesPath = join(path, "knowledge", "RULES.md");
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
    for (const filePath of sessionFiles) {
      const fileSessions = parseStateFile(
        filePath,
        path,
        projectName,
        projectGit,
      );
      sessions.push(...fileSessions);
    }

    // Add verification targets from rules
    if (rules?.verification_targets) {
      for (const session of sessions) {
        const verifyWith = session.verify_with;
        const track = session.track;

        // Try to find matching verification target
        // Priority: verify_with value > track name
        if (verifyWith && rules.verification_targets[verifyWith]) {
          session.verification_target = rules.verification_targets[verifyWith];
        } else if (track && rules.verification_targets[track]) {
          session.verification_target = rules.verification_targets[track];
        }
      }
    }

    if (sessions.length > 0) {
      projects.push({
        path,
        name: projectName,
        rules,
        sessions,
        git: projectGit,
      });
    }
  }

  return projects;
}

/**
 * Check if a path is a valid clockwork project.
 */
export function isClockworkProject(path: string): boolean {
  const expanded = expandPath(path);
  if (!existsSync(expanded)) return false;
  try {
    if (!statSync(expanded).isDirectory()) return false;
  } catch {
    return false;
  }
  const sessionFiles = findSessionStateFiles(expanded);
  return sessionFiles.length > 0;
}
