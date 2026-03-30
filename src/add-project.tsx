import {
  Action,
  ActionPanel,
  Detail,
  Icon,
  LocalStorage,
  showToast,
  Toast,
} from "@raycast/api";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { useState } from "react";

function pickFolder(): string | null {
  try {
    const script = `
      set chosenFolder to choose folder with prompt "Select a clockwork project folder"
      return POSIX path of chosenFolder
    `;
    const result = execSync(`osascript -e '${script}'`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return result || null;
  } catch {
    return null;
  }
}

export default function Command() {
  const [added, setAdded] = useState<string | null>(null);

  async function handlePick() {
    const path = pickFolder();
    if (!path) {
      return;
    }

    const cleanPath = path.replace(/\/$/, ""); // Remove trailing slash

    const knowledgeDir = join(cleanPath, "knowledge");
    if (!existsSync(knowledgeDir)) {
      showToast({
        style: Toast.Style.Failure,
        title: "Not a Clockwork Project",
        message: "No knowledge/ directory found",
      });
      return;
    }

    // Get existing projects from LocalStorage
    const existing = await LocalStorage.getItem<string>("additionalProjects");
    const projects = existing ? existing.split(",").map((s) => s.trim()).filter(Boolean) : [];

    if (projects.includes(cleanPath)) {
      showToast({
        style: Toast.Style.Failure,
        title: "Already Added",
        message: "This project is already tracked",
      });
      return;
    }

    projects.push(cleanPath);
    await LocalStorage.setItem("additionalProjects", projects.join(","));

    setAdded(cleanPath);
    showToast({
      style: Toast.Style.Success,
      title: "Project Added",
      message: cleanPath.replace(/^\/Users\/[^/]+/, "~"),
    });
  }

  const markdown = added
    ? `# Project Added\n\n**${added.replace(/^\/Users\/[^/]+/, "~")}**\n\nYou can now see this project in Browse Sessions and Quick Open.`
    : `# Add Project\n\nPress **Enter** to open a folder picker and select a clockwork project.\n\nThe folder must contain a \`knowledge/\` directory with SESSION-STATE files.`;

  return (
    <Detail
      markdown={markdown}
      actions={
        <ActionPanel>
          {!added && (
            <Action
              title="Choose Folder"
              icon={Icon.Folder}
              onAction={handlePick}
            />
          )}
          {added && (
            <Action.OpenWith
              path={added}
              title="Open Project"
            />
          )}
        </ActionPanel>
      }
    />
  );
}
