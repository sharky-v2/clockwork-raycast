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

type ViewMode = "status" | "project";

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

  const meta: string[] = [];
  meta.push(`**Status:** ${cfg.label}`);
  if (s.track) meta.push(`**Track:** ${s.track}`);
  meta.push(`**Branch:** \`${s.git.branch}\``);
  if (s.git.uncommittedChanges > 0)
    meta.push(`**Uncommitted:** ${s.git.uncommittedChanges} files`);
  if (s.verify_with) meta.push(`**Verify:** ${s.verify_with}`);
  if (s.blocked_by) meta.push(`**Blocked by:** ${s.blocked_by}`);

  const md = `# ${s.projectName} / ${sessionTitle(s)}

${s.goal ? `> ${s.goal}` : "*No goal specified*"}

---

${meta.join("\n\n")}

---

\`${s.projectPath.replace(/^\/Users\/[^/]+/, "~")}\`
`;

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

  const viewDropdown = (
    <List.Dropdown
      tooltip="View"
      value={viewMode}
      onChange={(v) => setViewMode(v as ViewMode)}
    >
      <List.Dropdown.Item title="By Project" value="project" />
      <List.Dropdown.Item title="By Status" value="status" />
    </List.Dropdown>
  );

  const renderSession = (s: Session, showProjectInTitle: boolean) => {
    const cfg = STATUS_CONFIG[s.status];
    const primary = getPrimaryAction(s, editor);

    const title = showProjectInTitle
      ? `${s.projectName} / ${sessionTitle(s)}`
      : sessionTitle(s);

    const accessories: List.Item.Accessory[] = [];
    if (s.blocked_by) {
      accessories.push({
        tag: { value: `← ${s.blocked_by}`, color: Color.SecondaryText },
      });
    }

    return (
      <List.Item
        key={`${s.projectPath}-${s.id}`}
        title={title}
        icon={{ source: cfg.icon, tintColor: cfg.color }}
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
              {items.map((s) => renderSession(s, false))}
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
              {items.map((s) => renderSession(s, true))}
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
