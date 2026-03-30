import { execSync } from "child_process";
import { GitInfo } from "./types";

export function getGitInfo(projectPath: string): GitInfo {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: projectPath,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    const statusOutput = execSync("git status --porcelain", {
      cwd: projectPath,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const uncommittedChanges = statusOutput
      .split("\n")
      .filter((line) => line.trim()).length;

    let lastCommit: string | undefined;
    let lastCommitDate: string | undefined;
    try {
      lastCommit = execSync("git log -1 --pretty=format:%s", {
        cwd: projectPath,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      lastCommitDate = execSync("git log -1 --pretty=format:%cr", {
        cwd: projectPath,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
    } catch {
      // No commits yet
    }

    return { branch, uncommittedChanges, lastCommit, lastCommitDate };
  } catch {
    return { branch: "unknown", uncommittedChanges: 0 };
  }
}

export function isGitRepo(path: string): boolean {
  try {
    execSync("git rev-parse --git-dir", {
      cwd: path,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}
