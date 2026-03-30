export interface SessionFrontmatter {
  session_id: string;
  status: "queued" | "in_progress" | "blocked" | "completed" | "handed_off";
  owner?: string;
  started?: string;
  verify_with?: "tests" | "build" | "lint" | "manual" | string;
  depends_on?: string[];
  [key: string]: unknown;
}

export interface RulesFrontmatter {
  project?: string;
  version?: string;
  [key: string]: unknown;
}

export interface GitInfo {
  branch: string;
  uncommittedChanges: number;
  lastCommit?: string;
  lastCommitDate?: string;
}

export interface Session {
  id: string;
  projectPath: string;
  projectName: string;
  filePath: string;
  frontmatter: SessionFrontmatter;
  git: GitInfo;
}

export interface ClockworkProject {
  path: string;
  name: string;
  rules?: RulesFrontmatter;
  sessions: Session[];
  git: GitInfo;
}
