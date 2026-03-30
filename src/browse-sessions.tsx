import {
  Action,
  ActionPanel,
  Color,
  getPreferenceValues,
  Icon,
  List,
  LocalStorage,
  showToast,
  Toast,
} from "@raycast/api";
import { execSync } from "child_process";
import { basename } from "path";
import { useEffect, useState } from "react";
import { expandPath, isClockworkProject, loadProjects } from "./scanner";
import { Session, SessionStatus } from "./types";

interface Preferences {
  defaultEditor: string;
}

const STORAGE_KEY = "clockwork_projects";

const STATUS_CONFIG: Record<SessionStatus, { color: Color; icon: Icon; label: string }> = {
  IN_PROGRESS: { color: Color.Blue, icon: Icon.CircleProgress50, label: "In Progress" },
  READY: { color: Color.Green, icon: Icon.Circle, label: "Ready" },
  TO_VERIFY: { color: Color.Orange, icon: Icon.Eye, label: "To Verify" },
  BLOCKED: { color: Color.Red, icon: Icon.XMarkCircle, label: "Blocked" },
  COMPLETE: { color: Color.SecondaryText, icon: Icon.CheckCircle, label: "Complete" },
};

function pickFolder(): string | null {
  try {
    return execSync(`osascript -e 'POSIX path of (choose folder with prompt "Select clockwork project")'`, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim().replace(/\/$/, "") || null;
  } catch { return null; }
}

function getRunningClaudeSessions(): Record<string, number> {
  const sessions: Record<string, number> = {};
  try {
    // Find all claude processes - both terminal and VS Code extension
    const pids = execSync(`pgrep -f "/claude|^claude"`, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
    if (!pids) return sessions;
    for (const pid of pids.split("\n")) {
      if (!pid.trim()) continue;
      try {
        const cwd = execSync(`lsof -a -p ${pid.trim()} -d cwd -F n 2>/dev/null | grep "^n" | cut -c2-`, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
        if (cwd) sessions[cwd] = (sessions[cwd] || 0) + 1;
      } catch {}
    }
  } catch {}
  return sessions;
}

function getPrimaryAction(s: Session, editor: string) {
  const v = s.verify_with, t = s.verification_target;
  if (v === "browser" || t?.app === "browser") return { title: "Open Browser", icon: Icon.Globe, fn: () => execSync(`open "${t?.url || "http://localhost:3000"}"`, { stdio: "pipe" }) };
  if (v === "xcode" || t?.app === "xcode") return { title: "Open Xcode", icon: Icon.Hammer, fn: () => execSync(`open -a Xcode "${t?.path ? s.projectPath + "/" + t.path : s.projectPath}"`, { stdio: "pipe" }) };
  if (v === "android_studio" || t?.app === "android_studio") return { title: "Open Android Studio", icon: Icon.Mobile, fn: () => execSync(`open -a "Android Studio" "${t?.path ? s.projectPath + "/" + t.path : s.projectPath}"`, { stdio: "pipe" }) };
  return { title: `Open ${editor === "code" ? "VS Code" : editor}`, icon: Icon.Code, fn: () => execSync(`${editor} "${s.projectPath}"`, { stdio: "pipe" }) };
}

function DetailMD(s: Session, live: number) {
  const c = STATUS_CONFIG[s.status];
  let md = `**${s.projectName}** / ${s.id}${s.track ? ` · ${s.track}` : ""}\n\n`;
  const tags = [];
  tags.push(`\`${c.label}\``);
  if (live > 0) tags.push(`\`${live} live\``);
  if (s.git.uncommittedChanges > 0) tags.push(`\`${s.git.uncommittedChanges} changes\``);
  md += tags.join("  ") + "\n";
  if (s.goal) md += `\n---\n\n${s.goal}\n`;
  md += `\n---\n\n\`${s.git.branch}\``;
  if (s.verify_with) md += ` · ${s.verify_with}`;
  if (s.verification_target?.url) md += ` · ${s.verification_target.url}`;
  if (s.blocked_by) md += `\n\nBlocked by ${s.blocked_by}`;
  return md;
}

export default function Command() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [liveSessions, setLiveSessions] = useState<Record<string, number>>({});
  const [storedPaths, setStoredPaths] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const prefs = getPreferenceValues<Preferences>();
  const editor = prefs.defaultEditor || "code";

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const stored = await LocalStorage.getItem<string>(STORAGE_KEY);
      const paths: string[] = stored ? JSON.parse(stored) : [];
      setStoredPaths(paths);
      const projects = loadProjects(paths);
      setSessions(projects.flatMap((p) => p.sessions));
      setLiveSessions(getRunningClaudeSessions());
      setIsLoading(false);
    })();
  }, [refreshKey]);

  async function handleAdd(path?: string) {
    const p = path || pickFolder();
    if (!p) return;
    const exp = expandPath(p);
    if (!path && !isClockworkProject(exp)) { await showToast({ style: Toast.Style.Failure, title: "Not a Clockwork Project" }); return; }
    const stored = await LocalStorage.getItem<string>(STORAGE_KEY);
    const paths: string[] = stored ? JSON.parse(stored) : [];
    if (paths.includes(exp)) { await showToast({ style: Toast.Style.Failure, title: "Already Added" }); return; }
    paths.push(exp);
    await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(paths));
    await showToast({ style: Toast.Style.Success, title: "Added" });
    setRefreshKey((k) => k + 1);
  }

  async function handleRemove(path: string) {
    const stored = await LocalStorage.getItem<string>(STORAGE_KEY);
    const paths: string[] = stored ? JSON.parse(stored) : [];
    await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(paths.filter((p) => p !== path)));
    await showToast({ style: Toast.Style.Success, title: "Removed" });
    setRefreshKey((k) => k + 1);
  }

  // Find live paths not yet in extension
  const livePathsNotAdded = Object.keys(liveSessions).filter((p) => !storedPaths.includes(p));

  // Sessions with live processes
  const liveSessionsInExt = sessions.filter((s) => liveSessions[s.projectPath]);
  const otherSessions = sessions.filter((s) => !liveSessions[s.projectPath]);

  const grouped: Record<string, Session[]> = {};
  for (const s of otherSessions) (grouped[s.status] ||= []).push(s);

  const statusOrder: SessionStatus[] = ["IN_PROGRESS", "READY", "TO_VERIFY", "BLOCKED", "COMPLETE"];

  const renderSession = (s: Session) => {
    const live = liveSessions[s.projectPath] || 0;
    const cfg = STATUS_CONFIG[s.status];
    const primary = getPrimaryAction(s, editor);
    const acc: List.Item.Accessory[] = [];
    if (live > 0) acc.push({ tag: { value: `${live} live`, color: Color.Green } });
    if (s.git.uncommittedChanges > 0) acc.push({ tag: { value: `${s.git.uncommittedChanges}`, color: Color.Orange } });

    return (
      <List.Item
        key={`${s.projectPath}-${s.id}`}
        title={s.track ? `${s.projectName} / ${s.track}-${s.id}` : `${s.projectName} / ${s.id}`}
        icon={{ source: cfg.icon, tintColor: cfg.color }}
        accessories={acc}
        detail={<List.Item.Detail markdown={DetailMD(s, live)} />}
        actions={
          <ActionPanel>
            <Action title={primary.title} icon={primary.icon} onAction={primary.fn} />
            <Action title="Open Editor" icon={Icon.Code} shortcut={{ modifiers: ["cmd"], key: "e" }} onAction={() => execSync(`${editor} "${s.projectPath}"`, { stdio: "pipe" })} />
            <Action.OpenWith path={s.filePath} title="Session File" shortcut={{ modifiers: ["cmd"], key: "o" }} />
            <Action title="Terminal" icon={Icon.Terminal} shortcut={{ modifiers: ["cmd"], key: "t" }} onAction={() => execSync(`open -a Terminal "${s.projectPath}"`, { stdio: "pipe" })} />
            <Action.ShowInFinder path={s.projectPath} shortcut={{ modifiers: ["cmd", "shift"], key: "f" }} />
            <Action title="Remove" icon={Icon.Trash} style={Action.Style.Destructive} shortcut={{ modifiers: ["ctrl"], key: "x" }} onAction={() => handleRemove(s.projectPath)} />
            <Action title="Refresh" icon={Icon.ArrowClockwise} shortcut={{ modifiers: ["cmd"], key: "r" }} onAction={() => setRefreshKey((k) => k + 1)} />
          </ActionPanel>
        }
      />
    );
  };

  return (
    <List isLoading={isLoading} isShowingDetail searchBarPlaceholder="Search..." actions={<ActionPanel><Action title="Add Project" icon={Icon.Plus} onAction={() => handleAdd()} /><Action title="Refresh" icon={Icon.ArrowClockwise} shortcut={{ modifiers: ["cmd"], key: "r" }} onAction={() => setRefreshKey((k) => k + 1)} /></ActionPanel>}>

      {/* Discovered live sessions not in extension */}
      {livePathsNotAdded.length > 0 && (
        <List.Section title="Live (not added)" subtitle={`${livePathsNotAdded.length}`}>
          {livePathsNotAdded.map((p) => (
            <List.Item
              key={p}
              title={basename(p)}
              icon={{ source: Icon.CircleFilled, tintColor: Color.Green }}
              accessories={[{ tag: { value: `${liveSessions[p]} live`, color: Color.Green } }]}
              detail={<List.Item.Detail markdown={`**${basename(p)}**\n\n\`${liveSessions[p]} active session${liveSessions[p] > 1 ? "s" : ""}\`\n\n---\n\n${p.replace(/^\/Users\/[^/]+/, "~")}\n\nPress Enter to add this project`} />}
              actions={
                <ActionPanel>
                  <Action title="Add Project" icon={Icon.Plus} onAction={() => handleAdd(p)} />
                  <Action title="Open Editor" icon={Icon.Code} onAction={() => execSync(`${editor} "${p}"`, { stdio: "pipe" })} />
                  <Action.ShowInFinder path={p} />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      )}

      {/* Live sessions in extension */}
      {liveSessionsInExt.length > 0 && (
        <List.Section title="Live" subtitle={`${liveSessionsInExt.length}`}>
          {liveSessionsInExt.map(renderSession)}
        </List.Section>
      )}

      {/* Other sessions by status */}
      {statusOrder.map((status) => {
        const items = grouped[status];
        if (!items?.length) return null;
        return (
          <List.Section key={status} title={STATUS_CONFIG[status].label} subtitle={`${items.length}`}>
            {items.map(renderSession)}
          </List.Section>
        );
      })}

      {sessions.length === 0 && livePathsNotAdded.length === 0 && !isLoading && (
        <List.EmptyView title="No Projects" description="Enter to add" icon={Icon.Plus} actions={<ActionPanel><Action title="Add Project" icon={Icon.Plus} onAction={() => handleAdd()} /></ActionPanel>} />
      )}
    </List>
  );
}
