import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { homedir } from "os";
import { basename, join } from "path";
import * as yaml from "js-yaml";
import { getGitInfo, isGitRepo } from "./git";
import {
  ClockworkProject,
  RulesFrontmatter,
  Session,
  SessionFrontmatter,
} from "./types";

const MAX_DEPTH = 4;

function expandPath(p: string): string {
  if (p.startsWith("~")) {
    return join(homedir(), p.slice(1));
  }
  return p;
}

function parseFrontmatter<T>(content: string): T | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
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
      try {
        const content = readFileSync(filePath, "utf-8");
        const frontmatter = parseFrontmatter<SessionFrontmatter>(content);
        if (frontmatter && frontmatter.session_id && frontmatter.status) {
          sessions.push({
            id: frontmatter.session_id,
            projectPath: dir,
            projectName,
            filePath,
            frontmatter,
            git: projectGit,
          });
        }
      } catch {
        // Ignore unreadable files
      }
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
      try {
        const content = readFileSync(filePath, "utf-8");
        const frontmatter = parseFrontmatter<SessionFrontmatter>(content);
        if (frontmatter && frontmatter.session_id && frontmatter.status) {
          sessions.push({
            id: frontmatter.session_id,
            projectPath: expanded,
            projectName,
            filePath,
            frontmatter,
            git: projectGit,
          });
        }
      } catch {
        // Ignore
      }
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

  // Dedupe
  const uniqueProjects: ClockworkProject[] = [];
  const seen = new Set<string>();
  for (const project of projects) {
    if (!seen.has(project.path)) {
      seen.add(project.path);
      uniqueProjects.push(project);
    }
  }

  return uniqueProjects;
}
