// Clockwork status values (uppercase)
export type SessionStatus =
  | "READY"
  | "IN_PROGRESS"
  | "TO_VERIFY"
  | "BLOCKED"
  | "COMPLETE";

// Canonical session schema v1
export interface SessionInfo {
  // Core (always present)
  status: SessionStatus;
  goal?: string;

  // Organization
  track?: string;

  // Dependencies
  blocked_by?: string;
  parallel_with?: string[];

  // File declarations (for parallelism analysis)
  creates?: string[];
  modifies?: string[];
  extends?: string[];

  // Planning
  estimate?: string;

  // Progress tracking
  completed?: string[];
  pending_verification?: string[];

  // Verification
  verify_with?: string | null;

  // Notes
  note?: string;
  result?: string;
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
  verification_targets?: Record<
    string,
    {
      app: string;
      url?: string;
      path?: string;
    }
  >;
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
  filePath: string;
  status: SessionStatus;
  git: GitInfo;

  // Core
  goal?: string;

  // Organization
  track?: string;

  // Dependencies
  blocked_by?: string;
  parallel_with?: string[];

  // File declarations
  creates?: string[];
  modifies?: string[];
  extends?: string[];

  // Planning
  estimate?: string;

  // Progress tracking
  completed?: string[];
  pending_verification?: string[];

  // Verification
  verify_with?: string | null;
  verification_target?: VerificationTarget;

  // Notes
  note?: string;
  result?: string;
}

export interface ClockworkProject {
  path: string;
  name: string;
  rules?: RulesFrontmatter;
  sessions: Session[];
  git: GitInfo;
}
