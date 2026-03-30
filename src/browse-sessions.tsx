import {
  Action,
  ActionPanel,
  Color,
  getPreferenceValues,
  Icon,
  List,
  LocalStorage,
  openExtensionPreferences,
  showToast,
  Toast,
} from "@raycast/api";
import { execSync } from "child_process";
import { useEffect, useState } from "react";
import { discoverProjects } from "./scanner";
import { Session, SessionStatus } from "./types";

interface Preferences {
  scanFolders: string;
  additionalProjects: string;
  defaultEditor: string;
}

const STATUS_ORDER: Record<SessionStatus, number> = {
  IN_PROGRESS: 0,
  READY: 1,
  TO_VERIFY: 2,
  BLOCKED: 3,
  COMPLETE: 4,
};

const STATUS_COLORS: Record<SessionStatus, Color> = {
  READY: Color.Green,
  IN_PROGRESS: Color.Blue,
  TO_VERIFY: Color.Orange,
  BLOCKED: Color.Red,
  COMPLETE: Color.SecondaryText,
};

const STATUS_ICONS: Record<SessionStatus, Icon> = {
  READY: Icon.Circle,
  IN_PROGRESS: Icon.CircleProgress50,
  TO_VERIFY: Icon.Eye,
  BLOCKED: Icon.XMarkCircle,
  COMPLETE: Icon.CheckCircle,
};

function getVerifyAction(session: Session): JSX.Element | null {
  const verify = session.verify_with;
  if (!verify) return null;

  const runCommand = (cmd: string, title: string) => {
    showToast({ style: Toast.Style.Animated, title: `Running ${title}...` });
    try {
      execSync(cmd, { cwd: session.projectPath, stdio: "pipe" });
      showToast({ style: Toast.Style.Success, title: `${title} passed` });
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: `${title} failed`,
        message: String(error),
      });
    }
  };

  switch (verify) {
    case "tests":
      return (
        <Action
          title="Run Tests"
          icon={Icon.Play}
          shortcut={{ modifiers: ["cmd"], key: "t" }}
          onAction={() => runCommand("npm test", "tests")}
        />
      );
    case "build":
      return (
        <Action
          title="Run Build"
          icon={Icon.Hammer}
          shortcut={{ modifiers: ["cmd"], key: "b" }}
          onAction={() => runCommand("npm run build", "build")}
        />
      );
    case "browser":
      return (
        <Action.OpenInBrowser
          title="Open in Browser"
          url="http://localhost:3000"
          shortcut={{ modifiers: ["cmd"], key: "o" }}
        />
      );
    case "xcode":
      return (
        <Action
          title="Open Xcode"
          icon={Icon.Hammer}
          shortcut={{ modifiers: ["cmd"], key: "x" }}
          onAction={() => {
            execSync(`open -a Xcode "${session.projectPath}"`, { stdio: "pipe" });
          }}
        />
      );
    case "android_studio":
      return (
        <Action
          title="Open Android Studio"
          icon={Icon.Mobile}
          shortcut={{ modifiers: ["cmd"], key: "a" }}
          onAction={() => {
            execSync(`open -a "Android Studio" "${session.projectPath}"`, { stdio: "pipe" });
          }}
        />
      );
    default:
      return null;
  }
}

function SessionItem({ session, editor }: { session: Session; editor: string }) {
  const verifyAction = getVerifyAction(session);
  const gitInfo = session.git;

  const accessories: List.Item.Accessory[] = [];

  if (session.goal) {
    accessories.push({ text: session.goal });
  }

  accessories.push({ text: gitInfo.branch, icon: Icon.CodeBlock });

  if (gitInfo.uncommittedChanges > 0) {
    accessories.push({
      tag: { value: "dirty", color: Color.Orange },
    });
  }

  const title = session.track
    ? `${session.projectName} / ${session.track}-${session.id}`
    : `${session.projectName} / Session ${session.id}`;

  return (
    <List.Item
      title={title}
      subtitle={session.goal}
      icon={{
        source: STATUS_ICONS[session.status] || Icon.Circle,
        tintColor: STATUS_COLORS[session.status],
      }}
      accessories={accessories}
      keywords={[
        session.projectName,
        session.status,
        session.track || "",
        session.goal || "",
      ]}
      actions={
        <ActionPanel>
          <ActionPanel.Section title="Open">
            <Action
              title={`Open in ${editor === "code" ? "VS Code" : editor}`}
              icon={Icon.Code}
              onAction={() => {
                execSync(`${editor} "${session.projectPath}"`, { stdio: "pipe" });
              }}
            />
            <Action.OpenWith
              path={session.filePath}
              title="Open Session File"
              shortcut={{ modifiers: ["cmd"], key: "o" }}
            />
            <Action
              title="Open in Terminal"
              icon={Icon.Terminal}
              shortcut={{ modifiers: ["cmd"], key: "t" }}
              onAction={() => {
                execSync(`open -a Terminal "${session.projectPath}"`, { stdio: "pipe" });
              }}
            />
            <Action.ShowInFinder
              path={session.projectPath}
              shortcut={{ modifiers: ["cmd", "shift"], key: "f" }}
            />
          </ActionPanel.Section>

          {verifyAction && (
            <ActionPanel.Section title="Verify">{verifyAction}</ActionPanel.Section>
          )}

          <ActionPanel.Section title="Copy">
            <Action.CopyToClipboard
              title="Copy Project Path"
              content={session.projectPath}
              shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

export default function Command() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const prefs = getPreferenceValues<Preferences>();
  const editor = prefs.defaultEditor || "code";

  useEffect(() => {
    async function load() {
      const scanFolders = prefs.scanFolders
        ? prefs.scanFolders.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

      const prefProjects = prefs.additionalProjects
        ? prefs.additionalProjects.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
      const storedProjects = await LocalStorage.getItem<string>("additionalProjects");
      const localProjects = storedProjects
        ? storedProjects.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

      const additionalProjects = [...new Set([...prefProjects, ...localProjects])];

      const projects = discoverProjects(scanFolders, additionalProjects);
      const allSessions = projects.flatMap((p) => p.sessions);

      // Sort by status priority
      allSessions.sort((a, b) => {
        const aOrder = STATUS_ORDER[a.status] ?? 99;
        const bOrder = STATUS_ORDER[b.status] ?? 99;
        return aOrder - bOrder;
      });

      setSessions(allSessions);
      setIsLoading(false);
    }
    load();
  }, []);

  // Group by status
  const grouped = sessions.reduce(
    (acc, session) => {
      const status = session.status;
      if (!acc[status]) acc[status] = [];
      acc[status].push(session);
      return acc;
    },
    {} as Record<string, Session[]>
  );

  const statusOrder: SessionStatus[] = ["IN_PROGRESS", "READY", "TO_VERIFY", "BLOCKED", "COMPLETE"];

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search sessions...">
      {statusOrder.map((status) => {
        const statusSessions = grouped[status];
        if (!statusSessions || statusSessions.length === 0) return null;
        return (
          <List.Section
            key={status}
            title={status.replace(/_/g, " ")}
            subtitle={`${statusSessions.length}`}
          >
            {statusSessions.map((session) => (
              <SessionItem
                key={`${session.projectPath}-${session.id}`}
                session={session}
                editor={editor}
              />
            ))}
          </List.Section>
        );
      })}
      {sessions.length === 0 && !isLoading && (
        <List.EmptyView
          title="No Sessions Found"
          description="Add scan folders or projects to discover clockwork sessions"
          icon={Icon.Folder}
          actions={
            <ActionPanel>
              <Action
                title="Configure Clockwork"
                icon={Icon.Gear}
                onAction={openExtensionPreferences}
              />
            </ActionPanel>
          }
        />
      )}
    </List>
  );
}
