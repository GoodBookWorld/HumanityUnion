export type WorkspaceNavRoute = { href: string; label: string };

export type WorkspaceNavGroup = {
  id: string;
  label: string;
  collapsible: boolean;
  routes: readonly WorkspaceNavRoute[];
};

/**
 * Pure Workspace sidebar group builder (Recovery Task 33 + Admin Panel foundation).
 * Administration group is included only when `showAdminPanel` is true.
 */
export function buildWorkspaceNavGroups(
  authoringRoute: WorkspaceNavRoute,
  editorialRoute: WorkspaceNavRoute | null,
  options: { showAdminPanel?: boolean } = {},
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

  const groups: WorkspaceNavGroup[] = [
    {
      id: "workspace",
      label: "Workspace",
      collapsible: false,
      routes: [{ href: "/workspace", label: "Workspace Home" }],
    },
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
  ];

  if (options.showAdminPanel) {
    groups.push({
      id: "administration",
      label: "Administration",
      collapsible: false,
      routes: [{ href: "/admin", label: "Admin Panel" }],
    });
  }

  groups.push({
    id: "public-profile",
    label: "Public Profile",
    collapsible: false,
    routes: [{ href: "/profile", label: "View Public Profile" }],
  });

  return groups;
}
