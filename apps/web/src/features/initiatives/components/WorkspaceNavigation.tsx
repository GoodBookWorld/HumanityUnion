"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { WorkspaceMemberIdentity } from "../../member-profile/components/WorkspaceMemberIdentity";
import {
  getCollapsedNavigationGroups,
  setCollapsedNavigationGroups,
} from "../../workspace-home/workspace-preferences-store";

import "./workspace-navigation.css";

const WORKSPACE_NAV_GROUPS = [
  {
    id: "home",
    label: "Home",
    routes: [{ href: "/workspace", label: "Workspace Home" }],
  },
  {
    id: "profile",
    label: "Profile",
    routes: [
      { href: "/workspace", label: "Workspace" },
      { href: "/profile", label: "Profile" },
      { href: "/preferences", label: "Preferences" },
      { href: "/membership", label: "Membership" },
      { href: "/notifications", label: "Notifications" },
      { href: "/account", label: "Account" },
      { href: "/member", label: "Member" },
    ],
  },
  {
    id: "civic",
    label: "Civic Work",
    routes: [
      { href: "/civic-activity", label: "My Civic Activity" },
      { href: "/workspace/initiatives", label: "Initiatives" },
    ],
  },
] as const;

function isRouteActive(pathname: string, href: string): boolean {
  if (href === "/workspace") {
    return pathname === "/workspace";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function WorkspaceNavigation() {
  const pathname = usePathname();
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);

  useEffect(() => {
    setCollapsedGroups(getCollapsedNavigationGroups());
  }, []);

  function toggleGroup(groupId: string) {
    setCollapsedGroups((current) => {
      const next = current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId];

      setCollapsedNavigationGroups(next);
      return next;
    });
  }

  return (
    <nav className="workspace-navigation" aria-label="Main workspace navigation">
      <WorkspaceMemberIdentity />
      <p className="workspace-navigation__label">Workspace</p>
      <div className="workspace-navigation__groups">
        {WORKSPACE_NAV_GROUPS.map((group) => {
          const collapsed = collapsedGroups.includes(group.id);

          return (
            <div key={group.id} className="workspace-navigation__group">
              <button
                type="button"
                className="workspace-navigation__group-toggle"
                aria-expanded={!collapsed}
                aria-controls={`workspace-nav-group-${group.id}`}
                onClick={() => toggleGroup(group.id)}
              >
                {group.label}
              </button>
              {!collapsed ? (
                <div id={`workspace-nav-group-${group.id}`} className="workspace-navigation__list">
                  {group.routes.map((route) => {
                    const active = isRouteActive(pathname, route.href);

                    return (
                      <Link
                        key={route.href}
                        className={`workspace-navigation__link${active ? " workspace-navigation__link--active" : ""}`}
                        href={route.href}
                        aria-current={active ? "page" : undefined}
                      >
                        {route.label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
