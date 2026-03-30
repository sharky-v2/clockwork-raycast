// Clockwork status values (uppercase)
export type SessionStatus = "READY" | "IN_PROGRESS" | "TO_VERIFY" | "BLOCKED" | "COMPLETE";

export interface SessionInfo {
  status: SessionStatus;
  goal?: string;
  verify_with?: string | null;
  blocked_by?: string;
}

export interface StateFrontmatter {
  project: string;
  track?: string;
  type?: "meta";
  tracks?: string[];
  current_session: string | number;
  status: SessionStatus;
  blocked_by?: string;
  last_updated?: string;
  sessions?: Record<string | number, SessionInfo>;
}

export interface RulesFrontmatter {
  project?: string;
  vscode_path?: string;
  verification_targets?: Record<string, {
    app: string;
    url?: string;
    path?: string;
  }>;
  [key: string]: unknown;
}

export interface GitInfo {
  branch: string;
  uncommittedChanges: number;
  lastCommit?: string;
  lastCommitDate?: string;
}

export interface VerificationTarget {
  app: string;
  url?: string;
  path?: string;
}

export interface Session {
  id: string;
  projectPath: string;
  projectName: string;
  track?: string;
  filePath: string;
  status: SessionStatus;
  goal?: string;
  verify_with?: string | null;
  verification_target?: VerificationTarget;
  blocked_by?: string;
  git: GitInfo;
}

export interface ClockworkProject {
  path: string;
  name: string;
  rules?: RulesFrontmatter;
  sessions: Session[];
  git: GitInfo;
}
