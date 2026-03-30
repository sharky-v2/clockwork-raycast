import {
  Action,
  ActionPanel,
  getPreferenceValues,
  Icon,
  List,
  LocalStorage,
  openExtensionPreferences,
  showHUD,
} from "@raycast/api";
import { execSync } from "child_process";
import { useEffect, useState } from "react";
import { discoverProjects } from "./scanner";
import { ClockworkProject } from "./types";

interface Preferences {
  scanFolders: string;
  additionalProjects: string;
  defaultEditor: string;
}

export default function Command() {
  const [projects, setProjects] = useState<ClockworkProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const prefs = getPreferenceValues<Preferences>();

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

      const discovered = discoverProjects(scanFolders, additionalProjects);
      setProjects(discovered);
      setIsLoading(false);
    }
    load();
  }, []);

  const openInEditor = (path: string) => {
    const editor = prefs.defaultEditor || "code";
    execSync(`${editor} "${path}"`, { stdio: "pipe" });
    showHUD(`Opened in ${editor}`);
  };

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search projects...">
      {projects.length === 0 && !isLoading ? (
        <List.EmptyView
          title="No Projects Found"
          description="Set up scan folders to discover clockwork projects"
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
      ) : (
        projects.map((project) => (
          <List.Item
            key={project.path}
            title={project.name}
            subtitle={project.path.replace(/^\/Users\/[^/]+/, "~")}
            icon={Icon.Folder}
            accessories={[
              { text: project.git.branch, icon: Icon.CodeBlock },
              project.git.uncommittedChanges > 0
                ? { text: "dirty", icon: Icon.Pencil }
                : { text: "clean", icon: Icon.CheckCircle },
            ]}
            actions={
              <ActionPanel>
                <Action
                  title={`Open in ${prefs.defaultEditor || "VS Code"}`}
                  icon={Icon.Code}
                  onAction={() => openInEditor(project.path)}
                />
                <Action
                  title="Open in Terminal"
                  icon={Icon.Terminal}
                  shortcut={{ modifiers: ["cmd"], key: "t" }}
                  onAction={() => {
                    execSync(`open -a Terminal "${project.path}"`, { stdio: "pipe" });
                  }}
                />
                <Action.ShowInFinder path={project.path} />
                <Action.CopyToClipboard
                  title="Copy Path"
                  content={project.path}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                />
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
