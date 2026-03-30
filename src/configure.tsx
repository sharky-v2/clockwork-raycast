import {
  Action,
  ActionPanel,
  Form,
  getPreferenceValues,
  Icon,
  openExtensionPreferences,
  showToast,
  Toast,
} from "@raycast/api";

interface Preferences {
  scanFolders: string;
  additionalProjects: string;
  defaultEditor: string;
}

export default function Command() {
  const prefs = getPreferenceValues<Preferences>();

  return (
    <Form
      actions={
        <ActionPanel>
          <Action
            title="Open Extension Preferences"
            icon={Icon.Gear}
            onAction={openExtensionPreferences}
          />
          <Action
            title="Show Current Config"
            icon={Icon.Info}
            onAction={() => {
              showToast({
                style: Toast.Style.Success,
                title: "Current Configuration",
                message: `Scan: ${prefs.scanFolders || "(none)"}\nProjects: ${prefs.additionalProjects || "(none)"}\nEditor: ${prefs.defaultEditor || "code"}`,
              });
            }}
          />
        </ActionPanel>
      }
    >
      <Form.Description
        title="Clockwork Configuration"
        text="Press Enter to open Extension Preferences where you can configure scan folders and other settings."
      />
      <Form.Separator />
      <Form.Description
        title="Current Scan Folders"
        text={prefs.scanFolders || "Not configured - press Enter to set up"}
      />
      <Form.Description
        title="Additional Projects"
        text={prefs.additionalProjects || "None added"}
      />
      <Form.Description
        title="Default Editor"
        text={prefs.defaultEditor || "VS Code (code)"}
      />
      <Form.Separator />
      <Form.Description
        title="How to Configure"
        text={`1. Press Enter to open preferences
2. Set "Scan Folders" to parent directories (e.g., ~/Documents/Projects)
3. Optionally add specific project paths
4. Choose your preferred editor`}
      />
    </Form>
  );
}
