import {
  Action,
  ActionPanel,
  Color,
  Icon,
  List,
  LocalStorage,
  showToast,
  Toast,
} from "@raycast/api";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { basename } from "path";
import { useEffect, useState } from "react";
import { expandPath, isClockworkProject, loadProjects } from "./scanner";
import { ClockworkProject } from "./types";

const STORAGE_KEY = "clockwork_projects";

interface StoredProject {
  path: string;
  loaded: ClockworkProject | null;
  error?: string;
}

function pickFolder(): string | null {
  try {
    const result = execSync(
      `osascript -e 'set f to choose folder with prompt "Select clockwork project"' -e 'return POSIX path of f'`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
    ).trim();
    return result.replace(/\/$/, "") || null;
  } catch {
    return null;
  }
}

export default function Command() {
  const [storedProjects, setStoredProjects] = useState<StoredProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const stored = await LocalStorage.getItem<string>(STORAGE_KEY);
        const paths: string[] = stored ? JSON.parse(stored) : [];

        // Load each path and track which ones fail
        const results: StoredProject[] = [];
        for (const path of paths) {
          const expanded = expandPath(path);
          if (!existsSync(expanded)) {
            results.push({ path, loaded: null, error: "Path not found" });
            continue;
          }

          const loaded = loadProjects([expanded]);
          if (loaded.length > 0) {
            results.push({ path, loaded: loaded[0] });
          } else {
            // Try to determine why it failed
            let error = "Unknown error";
            if (!isClockworkProject(expanded)) {
              error = "No SESSION-STATE*.md";
            } else {
              error = "Parse failed (check frontmatter)";
            }
            results.push({ path, loaded: null, error });
          }
        }

        setStoredProjects(results);
      } catch (e) {
        console.error("Load error:", e);
      }
      setIsLoading(false);
    })();
  }, [refreshKey]);

  async function handleAdd() {
    const path = pickFolder();
    if (!path) return;

    const expanded = expandPath(path);

    if (!isClockworkProject(expanded)) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Not a Clockwork Project",
        message: "No SESSION-STATE*.md found",
      });
      return;
    }

    try {
      const stored = await LocalStorage.getItem<string>(STORAGE_KEY);
      const paths: string[] = stored ? JSON.parse(stored) : [];

      if (paths.includes(expanded)) {
        await showToast({ style: Toast.Style.Failure, title: "Already Added" });
        return;
      }

      paths.push(expanded);
      await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(paths));
      await showToast({ style: Toast.Style.Success, title: "Project Added" });
      setRefreshKey((k) => k + 1);
    } catch (e) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Error",
        message: String(e),
      });
    }
  }

  async function handleRemove(path: string) {
    try {
      const stored = await LocalStorage.getItem<string>(STORAGE_KEY);
      const paths: string[] = stored ? JSON.parse(stored) : [];
      const filtered = paths.filter((p) => p !== path);
      await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      await showToast({ style: Toast.Style.Success, title: "Removed" });
      setRefreshKey((k) => k + 1);
    } catch (e) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Error",
        message: String(e),
      });
    }
  }

  async function handleClearAll() {
    await LocalStorage.removeItem(STORAGE_KEY);
    await showToast({
      style: Toast.Style.Success,
      title: "All projects cleared",
    });
    setRefreshKey((k) => k + 1);
  }

  const validProjects = storedProjects.filter((p) => p.loaded);
  const invalidProjects = storedProjects.filter((p) => !p.loaded);

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search projects..."
      actions={
        <ActionPanel>
          <Action title="Add Project" icon={Icon.Plus} onAction={handleAdd} />
          <Action
            title="Refresh"
            icon={Icon.ArrowClockwise}
            shortcut={{ modifiers: ["cmd"], key: "r" }}
            onAction={() => setRefreshKey((k) => k + 1)}
          />
          {storedProjects.length > 0 && (
            <Action
              title="Clear All"
              icon={Icon.Trash}
              style={Action.Style.Destructive}
              shortcut={{ modifiers: ["cmd", "shift"], key: "backspace" }}
              onAction={handleClearAll}
            />
          )}
        </ActionPanel>
      }
    >
      {validProjects.length > 0 && (
        <List.Section title="Projects" subtitle={`${validProjects.length}`}>
          {validProjects.map((p) => (
            <List.Item
              key={p.path}
              title={p.loaded!.name}
              subtitle={p.path.replace(/^\/Users\/[^/]+/, "~")}
              icon={{ source: Icon.Folder, tintColor: Color.Blue }}
              accessories={[
                {
                  text: `${p.loaded!.sessions.length} session${p.loaded!.sessions.length !== 1 ? "s" : ""}`,
                },
                { text: p.loaded!.git.branch, icon: Icon.CodeBlock },
              ]}
              actions={
                <ActionPanel>
                  <Action.ShowInFinder path={p.path} />
                  <Action
                    title="Remove"
                    icon={Icon.Trash}
                    style={Action.Style.Destructive}
                    onAction={() => handleRemove(p.path)}
                  />
                  <Action
                    title="Add Project"
                    icon={Icon.Plus}
                    onAction={handleAdd}
                  />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      )}

      {invalidProjects.length > 0 && (
        <List.Section
          title="Failed to Load"
          subtitle={`${invalidProjects.length}`}
        >
          {invalidProjects.map((p) => (
            <List.Item
              key={p.path}
              title={basename(p.path)}
              subtitle={p.path.replace(/^\/Users\/[^/]+/, "~")}
              icon={{ source: Icon.Warning, tintColor: Color.Red }}
              accessories={[{ text: p.error, icon: Icon.XMarkCircle }]}
              actions={
                <ActionPanel>
                  <Action
                    title="Remove"
                    icon={Icon.Trash}
                    style={Action.Style.Destructive}
                    onAction={() => handleRemove(p.path)}
                  />
                  <Action.ShowInFinder path={p.path} />
                  <Action
                    title="Add Project"
                    icon={Icon.Plus}
                    onAction={handleAdd}
                  />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      )}

      {storedProjects.length === 0 && !isLoading && (
        <List.EmptyView
          title="No Projects"
          description="Press Enter to add a clockwork project"
          icon={Icon.Plus}
          actions={
            <ActionPanel>
              <Action
                title="Add Project"
                icon={Icon.Plus}
                onAction={handleAdd}
              />
            </ActionPanel>
          }
        />
      )}
    </List>
  );
}
