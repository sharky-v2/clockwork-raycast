/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Scan Folders - Comma-separated list of parent folders to scan recursively */
  "scanFolders"?: string,
  /** Additional Projects - Comma-separated list of specific project paths */
  "additionalProjects"?: string,
  /** Default Editor - Editor to open projects with */
  "defaultEditor": "code" | "cursor" | "zed" | "subl"
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `browse-sessions` command */
  export type BrowseSessions = ExtensionPreferences & {}
  /** Preferences accessible in the `quick-open` command */
  export type QuickOpen = ExtensionPreferences & {}
  /** Preferences accessible in the `add-project` command */
  export type AddProject = ExtensionPreferences & {}
  /** Preferences accessible in the `configure` command */
  export type Configure = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `browse-sessions` command */
  export type BrowseSessions = {}
  /** Arguments passed to the `quick-open` command */
  export type QuickOpen = {}
  /** Arguments passed to the `add-project` command */
  export type AddProject = {}
  /** Arguments passed to the `configure` command */
  export type Configure = {}
}

