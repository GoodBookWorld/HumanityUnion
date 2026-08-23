export type WorkspaceNavRoute = { href: string; label: string };

export type WorkspaceNavGroup = {
  id: string;
  label: string;
  collapsible: boolean;
  routes: readonly WorkspaceNavRoute[];
};

/**
 * Pure Workspace sidebar group builder.
 * Admin Panel Pack 02 order: Workspace → Administration → Civic Work → Settings → Public Profile.
 * Administration group is included only when `showAdminPanel` is true.
 */
export function buildWorkspaceNavGroups(
  authoringRoute: WorkspaceNavRoute,
  editorialRoute: WorkspaceNavRoute | null,
  options: { showAdminPanel?: boolean; showEditorPanel?: boolean } = {},
): readonly WorkspaceNavGroup[] {
  const civicRoutes: WorkspaceNavRoute[] = [
    { href: "/civic-activity", label: "My Civic Activity" },
    { href: "/workspace/initiatives", label: "Initiatives" },
    { href: "/workspace/messages", label: "Messages" },
    authoringRoute,
  ];
  if (editorialRoute) {
    civicRoutes.push(editorialRoute);
  }

  const workspaceRoutes: WorkspaceNavRoute[] = [
    { href: "/workspace", label: "Workspace Home" },
  ];
  if (options.showEditorPanel) {
    workspaceRoutes.push({ href: "/workspace/editor", label: "Editor Panel" });
  }

  const groups: WorkspaceNavGroup[] = [
    {
      id: "workspace",
      label: "Workspace",
      collapsible: false,
      routes: workspaceRoutes,
    },
  ];

  if (options.showAdminPanel) {
    groups.push({
      id: "administration",
      label: "Administration",
      collapsible: false,
      routes: [{ href: "/admin", label: "Admin Panel" }],
    });
  }

  groups.push(
    {
      id: "civic",
      label: "Civic Work",
      collapsible: true,
      routes: civicRoutes,
    },
    {
      id: "settings",
      label: "Settings",
      collapsible: false,
      routes: [
        { href: "/account", label: "Account Security" },
        { href: "/member", label: "Profile" },
        { href: "/preferences", label: "Preferences" },
        { href: "/membership", label: "Membership" },
        { href: "/notifications", label: "Notifications" },
      ],
    },
    {
      id: "public-profile",
      label: "Public Profile",
      collapsible: false,
      routes: [{ href: "/profile", label: "View Public Profile" }],
    },
  );

  return groups;
}
