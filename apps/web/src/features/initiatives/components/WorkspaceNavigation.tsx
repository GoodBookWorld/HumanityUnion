import Link from "next/link";

import "./workspace-navigation.css";

const WORKSPACE_ROUTES = [
  { href: "/profile", label: "Profile" },
  { href: "/preferences", label: "Preferences" },
  { href: "/civic-activity", label: "My Civic Activity" },
  { href: "/initiatives", label: "Initiatives" },
] as const;

interface WorkspaceNavigationProps {
  current?: (typeof WORKSPACE_ROUTES)[number]["label"];
}

export function WorkspaceNavigation({ current }: WorkspaceNavigationProps) {
  return (
    <nav className="workspace-navigation" aria-label="Main workspace navigation">
      <p className="workspace-navigation__label">Workspace</p>
      <div className="workspace-navigation__list">
        {WORKSPACE_ROUTES.map((route) => {
          const isActive = current === route.label;

          return (
            <Link
              key={route.href}
              className={`workspace-navigation__link${isActive ? " workspace-navigation__link--active" : ""}`}
              href={route.href}
              aria-current={isActive ? "page" : undefined}
            >
              {route.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
