import {
  Action,
  ActionPanel,
  Color,
  getPreferenceValues,
  Icon,
  List,
  showToast,
  Toast,
} from "@raycast/api";
import { execSync } from "child_process";
import { useEffect, useState } from "react";
import { discoverProjects } from "./scanner";
import { Session } from "./types";

interface Preferences {
  scanFolders: string;
  additionalProjects: string;
}

const STATUS_ORDER: Record<string, number> = {
  in_progress: 0,
  blocked: 1,
  queued: 2,
  handed_off: 3,
  completed: 4,
};

const STATUS_COLORS: Record<string, Color> = {
  in_progress: Color.Green,
  blocked: Color.Red,
  queued: Color.Yellow,
  handed_off: Color.Blue,
  completed: Color.SecondaryText,
};

const STATUS_ICONS: Record<string, Icon> = {
  in_progress: Icon.Circle,
  blocked: Icon.XMarkCircle,
  queued: Icon.Clock,
  handed_off: Icon.ArrowRight,
  completed: Icon.CheckCircle,
};

function getVerifyAction(session: Session): JSX.Element | null {
  const verify = session.frontmatter.verify_with;
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
    case "lint":
      return (
        <Action
          title="Run Lint"
          icon={Icon.MagnifyingGlass}
          shortcut={{ modifiers: ["cmd"], key: "l" }}
          onAction={() => runCommand("npm run lint", "lint")}
        />
      );
    case "manual":
      return (
        <Action
          title="Open for Manual Review"
          icon={Icon.Eye}
          shortcut={{ modifiers: ["cmd"], key: "m" }}
          onAction={() => {
            execSync(`open "${session.projectPath}"`, { stdio: "pipe" });
          }}
        />
      );
    default:
      // Custom command
      return (
        <Action
          title={`Run: ${verify}`}
          icon={Icon.Terminal}
          shortcut={{ modifiers: ["cmd"], key: "r" }}
          onAction={() => runCommand(verify, verify)}
        />
      );
  }
}

function SessionItem({ session }: { session: Session }) {
  const verifyAction = getVerifyAction(session);
  const gitInfo = session.git;

  const accessories: List.Item.Accessory[] = [
    { text: gitInfo.branch, icon: Icon.CodeBlock },
  ];

  if (gitInfo.uncommittedChanges > 0) {
    accessories.push({
      text: `${gitInfo.uncommittedChanges} changes`,
      icon: Icon.Pencil,
    });
  }

  if (gitInfo.lastCommitDate) {
    accessories.push({ text: gitInfo.lastCommitDate, icon: Icon.Clock });
  }

  return (
    <List.Item
      title={session.id}
      subtitle={session.projectName}
      icon={{ source: STATUS_ICONS[session.frontmatter.status] || Icon.Circle, tintColor: STATUS_COLORS[session.frontmatter.status] }}
      accessories={accessories}
      keywords={[
        session.projectName,
        session.frontmatter.status,
        session.frontmatter.owner || "",
      ]}
      actions={
        <ActionPanel>
          <ActionPanel.Section title="Session">
            <Action.OpenWith
              path={session.filePath}
              title="Open Session File"
            />
            <Action.ShowInFinder path={session.projectPath} />
            <Action.CopyToClipboard
              title="Copy Project Path"
              content={session.projectPath}
              shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
            />
          </ActionPanel.Section>

          {verifyAction && (
            <ActionPanel.Section title="Verify">{verifyAction}</ActionPanel.Section>
          )}

          <ActionPanel.Section title="Git">
            <Action
              title="Open in Terminal"
              icon={Icon.Terminal}
              shortcut={{ modifiers: ["cmd", "shift"], key: "t" }}
              onAction={() => {
                execSync(
                  `open -a Terminal "${session.projectPath}"`,
                  { stdio: "pipe" }
                );
              }}
            />
            <Action
              title="Open in VS Code"
              icon={Icon.Code}
              shortcut={{ modifiers: ["cmd", "shift"], key: "v" }}
              onAction={() => {
                execSync(`code "${session.projectPath}"`, { stdio: "pipe" });
              }}
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

  useEffect(() => {
    const prefs = getPreferenceValues<Preferences>();
    const scanFolders = prefs.scanFolders
      ? prefs.scanFolders.split(",").map((s) => s.trim())
      : [];
    const additionalProjects = prefs.additionalProjects
      ? prefs.additionalProjects.split(",").map((s) => s.trim())
      : [];

    const projects = discoverProjects(scanFolders, additionalProjects);
    const allSessions = projects.flatMap((p) => p.sessions);

    // Sort by status priority
    allSessions.sort((a, b) => {
      const aOrder = STATUS_ORDER[a.frontmatter.status] ?? 99;
      const bOrder = STATUS_ORDER[b.frontmatter.status] ?? 99;
      return aOrder - bOrder;
    });

    setSessions(allSessions);
    setIsLoading(false);
  }, []);

  // Group by status
  const grouped = sessions.reduce(
    (acc, session) => {
      const status = session.frontmatter.status;
      if (!acc[status]) acc[status] = [];
      acc[status].push(session);
      return acc;
    },
    {} as Record<string, Session[]>
  );

  const statusOrder = ["in_progress", "blocked", "queued", "handed_off", "completed"];

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search sessions...">
      {statusOrder.map((status) => {
        const statusSessions = grouped[status];
        if (!statusSessions || statusSessions.length === 0) return null;
        return (
          <List.Section
            key={status}
            title={status.replace(/_/g, " ").toUpperCase()}
            subtitle={`${statusSessions.length} session${statusSessions.length > 1 ? "s" : ""}`}
          >
            {statusSessions.map((session) => (
              <SessionItem key={`${session.projectPath}-${session.id}`} session={session} />
            ))}
          </List.Section>
        );
      })}
      {sessions.length === 0 && !isLoading && (
        <List.EmptyView
          title="No Sessions Found"
          description="Configure scan folders in extension preferences"
          icon={Icon.MagnifyingGlass}
        />
      )}
    </List>
  );
}
