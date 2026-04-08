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
import { useEffect, useState } from "react";
import { expandPath, isClockworkProject, loadProjects } from "./scanner";
import { Session, SessionStatus } from "./types";

interface Preferences {
  defaultEditor: string;
  showComplete: boolean;
}

const STORAGE_KEY = "clockwork_projects";

const STATUS_CONFIG: Record<
  SessionStatus,
  { color: Color; icon: Icon; label: string }
> = {
  READY: { color: Color.Green, icon: Icon.Circle, label: "Ready" },
  IN_PROGRESS: {
    color: Color.Blue,
    icon: Icon.CircleProgress50,
    label: "In Progress",
  },
  TO_VERIFY: { color: Color.Orange, icon: Icon.Eye, label: "To Verify" },
  BLOCKED: {
    color: Color.SecondaryText,
    icon: Icon.XMarkCircle,
    label: "Blocked",
  },
  COMPLETE: {
    color: Color.SecondaryText,
    icon: Icon.CheckCircle,
    label: "Complete",
  },
};

const STATUS_ORDER: SessionStatus[] = [
  "READY",
  "IN_PROGRESS",
  "TO_VERIFY",
  "BLOCKED",
  "COMPLETE",
];

type ViewMode = "status" | "project" | "track";

/**
 * Check if a BLOCKED session is effectively unblocked
 * (its blocker is TO_VERIFY or COMPLETE)
 */
function isEffectivelyUnblocked(
  session: Session,
  allSessions: Session[],
): boolean {
  if (session.status !== "BLOCKED" || !session.blocked_by) return false;

  const blocker = allSessions.find(
    (s) =>
      s.id === session.blocked_by &&
      s.projectPath === session.projectPath,
  );

  if (!blocker) return false;
  return blocker.status === "TO_VERIFY" || blocker.status === "COMPLETE";
}

function pickFolder(): string | null {
  try {
    return (
      execSync(
        `osascript -e 'POSIX path of (choose folder with prompt "Select clockwork project")'`,
        { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
      )
        .trim()
        .replace(/\/$/, "") || null
    );
  } catch {
    return null;
  }
}

function getPrimaryAction(s: Session, editor: string) {
  const v = s.verify_with,
    t = s.verification_target;
  if (v === "browser" || t?.app === "browser")
    return {
      title: "Open Browser",
      icon: Icon.Globe,
      fn: () => execSync(`open "${t?.url || "http://localhost:3000"}"`),
    };
  if (v === "xcode" || t?.app === "xcode")
    return {
      title: "Open Xcode",
      icon: Icon.Hammer,
      fn: () =>
        execSync(
          `open -a Xcode "${t?.path ? s.projectPath + "/" + t.path : s.projectPath}"`,
        ),
    };
  if (v === "android_studio" || t?.app === "android_studio")
    return {
      title: "Open Android Studio",
      icon: Icon.Mobile,
      fn: () =>
        execSync(
          `open -a "Android Studio" "${t?.path ? s.projectPath + "/" + t.path : s.projectPath}"`,
        ),
    };
  return {
    title: `Open ${editor === "code" ? "VS Code" : editor}`,
    icon: Icon.Code,
    fn: () => execSync(`${editor} "${s.projectPath}"`),
  };
}

function sessionTitle(s: Session): string {
  if (s.track) return `${s.track}-${s.id}`;
  return `Session ${s.id}`;
}

function DetailPanel({ s }: { s: Session }) {
  const cfg = STATUS_CONFIG[s.status];

  // Core metadata
  const meta: string[] = [];
  meta.push(`**Status:** ${cfg.label}`);
  if (s.track) meta.push(`**Track:** ${s.track}`);
  if (s.estimate) meta.push(`**Estimate:** ${s.estimate}`);
  meta.push(`**Branch:** \`${s.git.branch}\``);
  if (s.git.uncommittedChanges > 0)
    meta.push(`**Uncommitted:** ${s.git.uncommittedChanges} files`);

  // Dependencies
  const deps: string[] = [];
  if (s.blocked_by) deps.push(`**Blocked by:** ${s.blocked_by}`);
  if (s.parallel_with?.length)
    deps.push(`**Parallel with:** ${s.parallel_with.join(", ")}`);

  // File declarations
  const files: string[] = [];
  if (s.creates?.length) files.push(`**Creates:** \`${s.creates.join("`, `")}\``);
  if (s.modifies?.length) files.push(`**Modifies:** \`${s.modifies.join("`, `")}\``);
  if (s.extends?.length) files.push(`**Extends:** \`${s.extends.join("`, `")}\``);

  // Progress
  const progress: string[] = [];
  if (s.completed?.length) progress.push(`**Completed:** ${s.completed.join(", ")}`);
  if (s.pending_verification?.length)
    progress.push(`**Pending verification:** ${s.pending_verification.join(", ")}`);

  // Verification & notes
  const notes: string[] = [];
  if (s.verify_with) notes.push(`**Verify with:** ${s.verify_with}`);
  if (s.note) notes.push(`**Note:** ${s.note}`);
  if (s.result) notes.push(`**Result:** ${s.result}`);

  // Build markdown
  let md = `# ${s.projectName} / ${sessionTitle(s)}\n\n`;
  md += s.goal ? `> ${s.goal}\n\n` : "*No goal specified*\n\n";
  md += "---\n\n";
  md += meta.join("\n\n") + "\n\n";

  if (deps.length) {
    md += "---\n\n### Dependencies\n\n" + deps.join("\n\n") + "\n\n";
  }

  if (files.length) {
    md += "---\n\n### Files\n\n" + files.join("\n\n") + "\n\n";
  }

  if (progress.length) {
    md += "---\n\n### Progress\n\n" + progress.join("\n\n") + "\n\n";
  }

  if (notes.length) {
    md += "---\n\n### Notes\n\n" + notes.join("\n\n") + "\n\n";
  }

  md += "---\n\n";
  md += `\`${s.projectPath.replace(/^\/Users\/[^/]+/, "~")}\``;

  return <List.Item.Detail markdown={md} />;
}

export default function Command() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [storedPaths, setStoredPaths] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("project");
  const prefs = getPreferenceValues<Preferences>();
  const editor = prefs.defaultEditor || "code";
  const showComplete = prefs.showComplete ?? false;

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const stored = await LocalStorage.getItem<string>(STORAGE_KEY);
      const paths: string[] = stored ? JSON.parse(stored) : [];
      setStoredPaths(paths);
      const projects = loadProjects(paths);
      setSessions(projects.flatMap((p) => p.sessions));
      setIsLoading(false);
    })();
  }, [refreshKey]);

  async function handleAdd(path?: string) {
    const p = path || pickFolder();
    if (!p) return;
    const exp = expandPath(p);
    if (!path && !isClockworkProject(exp)) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Not a Clockwork Project",
      });
      return;
    }
    const stored = await LocalStorage.getItem<string>(STORAGE_KEY);
    const paths: string[] = stored ? JSON.parse(stored) : [];
    if (paths.includes(exp)) {
      await showToast({ style: Toast.Style.Failure, title: "Already Added" });
      return;
    }
    paths.push(exp);
    await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(paths));
    await showToast({ style: Toast.Style.Success, title: "Added" });
    setRefreshKey((k) => k + 1);
  }

  async function handleRemove(path: string) {
    const stored = await LocalStorage.getItem<string>(STORAGE_KEY);
    const paths: string[] = stored ? JSON.parse(stored) : [];
    await LocalStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(paths.filter((p) => p !== path)),
    );
    await showToast({ style: Toast.Style.Success, title: "Removed" });
    setRefreshKey((k) => k + 1);
  }

  const visibleSessions = showComplete
    ? sessions
    : sessions.filter((s) => s.status !== "COMPLETE");

  // Group by status
  const byStatus: Record<SessionStatus, Session[]> = {
    READY: [],
    IN_PROGRESS: [],
    TO_VERIFY: [],
    BLOCKED: [],
    COMPLETE: [],
  };
  for (const s of visibleSessions) byStatus[s.status].push(s);

  // Group by project
  const byProject: Record<string, Session[]> = {};
  for (const s of visibleSessions) {
    (byProject[s.projectName] ||= []).push(s);
  }

  // Group by track (across all projects)
  const byTrack: Record<string, Session[]> = {};
  for (const s of visibleSessions) {
    const trackKey = s.track || "(no track)";
    (byTrack[trackKey] ||= []).push(s);
  }

  const viewDropdown = (
    <List.Dropdown
      tooltip="View"
      value={viewMode}
      onChange={(v) => setViewMode(v as ViewMode)}
    >
      <List.Dropdown.Item title="By Project" value="project" />
      <List.Dropdown.Item title="By Track" value="track" />
      <List.Dropdown.Item title="By Status" value="status" />
    </List.Dropdown>
  );

  const renderSession = (
    s: Session,
    showProjectInTitle: boolean,
    showTrackInTitle = false,
  ) => {
    const cfg = STATUS_CONFIG[s.status];
    const primary = getPrimaryAction(s, editor);
    const unblocked = isEffectivelyUnblocked(s, sessions);

    let title = sessionTitle(s);
    if (showProjectInTitle) title = `${s.projectName} / ${title}`;
    if (showTrackInTitle && s.track) title = `${s.track} / ${title}`;

    const accessories: List.Item.Accessory[] = [];

    // Effectively unblocked indicator (blocker is TO_VERIFY/COMPLETE)
    if (unblocked) {
      accessories.push({
        tag: { value: "unblocked", color: Color.Green },
        tooltip: `Blocker ${s.blocked_by} is done — can start now`,
      });
    }

    // Progress indicator (completed/pending)
    if (s.completed?.length || s.pending_verification?.length) {
      const done = s.completed?.length || 0;
      const pending = s.pending_verification?.length || 0;
      accessories.push({
        tag: { value: `${done}/${done + pending}`, color: Color.Purple },
        tooltip: `${done} completed, ${pending} pending`,
      });
    }

    // Blocked by (show in yellow if unblocked, red if truly blocked)
    if (s.blocked_by) {
      accessories.push({
        tag: {
          value: `← ${s.blocked_by}`,
          color: unblocked ? Color.Yellow : Color.Red,
        },
        tooltip: unblocked
          ? `Was blocked by ${s.blocked_by} (now done)`
          : `Blocked by ${s.blocked_by}`,
      });
    }

    // Parallel indicator
    if (s.parallel_with?.length) {
      accessories.push({
        icon: { source: Icon.ArrowsContract, tintColor: Color.Green },
        tooltip: `Can run with: ${s.parallel_with.join(", ")}`,
      });
    }

    // Use green icon for effectively unblocked sessions
    const icon = unblocked
      ? { source: Icon.CircleProgress25, tintColor: Color.Green }
      : { source: cfg.icon, tintColor: cfg.color };

    return (
      <List.Item
        key={`${s.projectPath}-${s.id}`}
        title={title}
        icon={icon}
        accessories={accessories}
        detail={<DetailPanel s={s} />}
        actions={
          <ActionPanel>
            <Action
              title={primary.title}
              icon={primary.icon}
              onAction={primary.fn}
            />
            <Action
              title="Open Editor"
              icon={Icon.Code}
              shortcut={{ modifiers: ["cmd"], key: "e" }}
              onAction={() => execSync(`${editor} "${s.projectPath}"`)}
            />
            <Action.OpenWith
              path={s.filePath}
              title="Edit Session File"
              shortcut={{ modifiers: ["cmd"], key: "o" }}
            />
            <Action
              title="Terminal"
              icon={Icon.Terminal}
              shortcut={{ modifiers: ["cmd"], key: "t" }}
              onAction={() => execSync(`open -a Terminal "${s.projectPath}"`)}
            />
            <Action.ShowInFinder
              path={s.projectPath}
              shortcut={{ modifiers: ["cmd", "shift"], key: "f" }}
            />
            <Action
              title="Remove Project"
              icon={Icon.Trash}
              style={Action.Style.Destructive}
              shortcut={{ modifiers: ["ctrl"], key: "x" }}
              onAction={() => handleRemove(s.projectPath)}
            />
            <Action
              title="Refresh"
              icon={Icon.ArrowClockwise}
              shortcut={{ modifiers: ["cmd"], key: "r" }}
              onAction={() => setRefreshKey((k) => k + 1)}
            />
          </ActionPanel>
        }
      />
    );
  };

  return (
    <List
      isLoading={isLoading}
      isShowingDetail
      searchBarPlaceholder="Search sessions..."
      searchBarAccessory={viewDropdown}
      actions={
        <ActionPanel>
          <Action
            title="Add Project"
            icon={Icon.Plus}
            onAction={() => handleAdd()}
          />
          <Action
            title="Refresh"
            icon={Icon.ArrowClockwise}
            shortcut={{ modifiers: ["cmd"], key: "r" }}
            onAction={() => setRefreshKey((k) => k + 1)}
          />
        </ActionPanel>
      }
    >
      {viewMode === "project" &&
        Object.entries(byProject).map(([projectName, items]) => {
          const uncommitted = items[0]?.git.uncommittedChanges || 0;
          const subtitle =
            uncommitted > 0
              ? `${items.length} · ${uncommitted} uncommitted`
              : `${items.length}`;
          return (
            <List.Section
              key={projectName}
              title={projectName}
              subtitle={subtitle}
            >
              {items.map((s) => renderSession(s, false, false))}
            </List.Section>
          );
        })}

      {viewMode === "track" &&
        Object.entries(byTrack)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([trackName, items]) => {
            const ready = items.filter((s) => s.status === "READY").length;
            const inProgress = items.filter(
              (s) => s.status === "IN_PROGRESS",
            ).length;
            const blocked = items.filter((s) => s.status === "BLOCKED").length;
            const parts: string[] = [];
            if (ready) parts.push(`${ready} ready`);
            if (inProgress) parts.push(`${inProgress} active`);
            if (blocked) parts.push(`${blocked} blocked`);
            const subtitle = parts.length ? parts.join(" · ") : `${items.length}`;
            return (
              <List.Section key={trackName} title={trackName} subtitle={subtitle}>
                {items.map((s) => renderSession(s, true, false))}
              </List.Section>
            );
          })}

      {viewMode === "status" &&
        STATUS_ORDER.map((status) => {
          if (status === "COMPLETE" && !showComplete) return null;
          const items = byStatus[status];
          if (!items.length) return null;
          return (
            <List.Section
              key={status}
              title={STATUS_CONFIG[status].label}
              subtitle={`${items.length}`}
            >
              {items.map((s) => renderSession(s, true, true))}
            </List.Section>
          );
        })}

      {visibleSessions.length === 0 && !isLoading && (
        <List.EmptyView
          title="No Sessions"
          description="Add a clockwork project to get started"
          icon={Icon.Plus}
          actions={
            <ActionPanel>
              <Action
                title="Add Project"
                icon={Icon.Plus}
                onAction={() => handleAdd()}
              />
            </ActionPanel>
          }
        />
      )}
    </List>
  );
}
