/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Default Editor - Editor to open projects with */
  "defaultEditor": "code" | "cursor" | "zed" | "subl"
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `browse-sessions` command */
  export type BrowseSessions = ExtensionPreferences & {}
  /** Preferences accessible in the `manage-projects` command */
  export type ManageProjects = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `browse-sessions` command */
  export type BrowseSessions = {}
  /** Arguments passed to the `manage-projects` command */
  export type ManageProjects = {}
}

