/**
 * Production Completion Pack 02E Task 05 — workspace nav display labels.
 *
 * Stable English labels from `buildWorkspaceNavGroups` / Blog `navLabel` remain
 * identity for hrefs, filtering, permissions, React keys, and API contracts.
 * Translated strings are presentation-only.
 */

import type { AbstractIntlMessages } from "next-intl";

/** Keys resolved from the `workspace` message namespace. */
export const WORKSPACE_NAV_WORKSPACE_MESSAGE_KEYS = {
  "Workspace Home": "workspaceHome",
  "Editor Panel": "editorPanel",
  Administration: "administration",
  "Admin Panel": "adminPanel",
  "Civic Work": "civicWork",
  "My Civic Activity": "myCivicActivity",
  Messages: "messages",
  Settings: "settings",
  Profile: "profile",
  Preferences: "preferences",
  Notifications: "notifications",
  "Public Profile": "publicProfile",
  "View Public Profile": "viewPublicProfile",
  "Editorial Review": "editorialReview",
  "Become an Author": "becomeAnAuthor",
  Publishing: "publishing",
} as const;

/** Keys resolved from the `navigation` message namespace (reuse). */
export const WORKSPACE_NAV_NAVIGATION_MESSAGE_KEYS = {
  Workspace: "workspace",
  Initiatives: "initiatives",
  Membership: "membership",
} as const;

/** Keys resolved from the `auth` message namespace (reuse). */
export const WORKSPACE_NAV_AUTH_MESSAGE_KEYS = {
  "Account Security": "accountSecurity",
} as const;

export type WorkspaceNavWorkspaceMessageKey =
  (typeof WORKSPACE_NAV_WORKSPACE_MESSAGE_KEYS)[keyof typeof WORKSPACE_NAV_WORKSPACE_MESSAGE_KEYS];

export type WorkspaceNavNavigationMessageKey =
  (typeof WORKSPACE_NAV_NAVIGATION_MESSAGE_KEYS)[keyof typeof WORKSPACE_NAV_NAVIGATION_MESSAGE_KEYS];

export type WorkspaceNavAuthMessageKey =
  (typeof WORKSPACE_NAV_AUTH_MESSAGE_KEYS)[keyof typeof WORKSPACE_NAV_AUTH_MESSAGE_KEYS];

export interface WorkspaceNavTranslators {
  workspace: (key: WorkspaceNavWorkspaceMessageKey) => string;
  navigation: (key: WorkspaceNavNavigationMessageKey) => string;
  auth: (key: WorkspaceNavAuthMessageKey) => string;
}

/**
 * Resolve display text for a stable workspace-nav English label.
 * Unmapped labels (including unexpected API strings) keep English identity.
 */
export function resolveWorkspaceNavDisplayLabel(
  stableLabel: string,
  translators: WorkspaceNavTranslators,
): string {
  if (stableLabel in WORKSPACE_NAV_WORKSPACE_MESSAGE_KEYS) {
    return translators.workspace(
      WORKSPACE_NAV_WORKSPACE_MESSAGE_KEYS[
        stableLabel as keyof typeof WORKSPACE_NAV_WORKSPACE_MESSAGE_KEYS
      ],
    );
  }
  if (stableLabel in WORKSPACE_NAV_NAVIGATION_MESSAGE_KEYS) {
    return translators.navigation(
      WORKSPACE_NAV_NAVIGATION_MESSAGE_KEYS[
        stableLabel as keyof typeof WORKSPACE_NAV_NAVIGATION_MESSAGE_KEYS
      ],
    );
  }
  if (stableLabel in WORKSPACE_NAV_AUTH_MESSAGE_KEYS) {
    return translators.auth(
      WORKSPACE_NAV_AUTH_MESSAGE_KEYS[
        stableLabel as keyof typeof WORKSPACE_NAV_AUTH_MESSAGE_KEYS
      ],
    );
  }
  return stableLabel;
}

/**
 * Blog authoring access `navLabel` contract stays English:
 * `"Become an Author" | "Publishing"`. Presentation only via this map.
 */
export function resolveBlogNavLabelDisplay(
  navLabel: string,
  translateWorkspace: (key: "becomeAnAuthor" | "publishing") => string,
): string {
  if (navLabel === "Publishing") {
    return translateWorkspace("publishing");
  }
  if (navLabel === "Become an Author") {
    return translateWorkspace("becomeAnAuthor");
  }
  return navLabel;
}

/** Test/helper path: resolve from a loaded messages object (no React). */
export function resolveWorkspaceNavDisplayLabelFromMessages(
  stableLabel: string,
  messages: AbstractIntlMessages,
): string {
  const pick = (namespace: string, key: string): string | undefined => {
    const ns = (messages as Record<string, unknown>)[namespace];
    if (ns == null || typeof ns !== "object" || Array.isArray(ns)) {
      return undefined;
    }
    const value = (ns as Record<string, unknown>)[key];
    return typeof value === "string" ? value : undefined;
  };

  if (stableLabel in WORKSPACE_NAV_WORKSPACE_MESSAGE_KEYS) {
    const key =
      WORKSPACE_NAV_WORKSPACE_MESSAGE_KEYS[
        stableLabel as keyof typeof WORKSPACE_NAV_WORKSPACE_MESSAGE_KEYS
      ];
    return pick("workspace", key) ?? stableLabel;
  }
  if (stableLabel in WORKSPACE_NAV_NAVIGATION_MESSAGE_KEYS) {
    const key =
      WORKSPACE_NAV_NAVIGATION_MESSAGE_KEYS[
        stableLabel as keyof typeof WORKSPACE_NAV_NAVIGATION_MESSAGE_KEYS
      ];
    return pick("navigation", key) ?? stableLabel;
  }
  if (stableLabel in WORKSPACE_NAV_AUTH_MESSAGE_KEYS) {
    const key =
      WORKSPACE_NAV_AUTH_MESSAGE_KEYS[
        stableLabel as keyof typeof WORKSPACE_NAV_AUTH_MESSAGE_KEYS
      ];
    return pick("auth", key) ?? stableLabel;
  }
  return stableLabel;
}
