"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { fetchBlogAuthoringAccessState } from "../../blog/authoring-api";
import { WorkspaceMemberIdentity } from "../../member-profile/components/WorkspaceMemberIdentity";
import {
  getCollapsedNavigationGroups,
  setCollapsedNavigationGroups,
} from "../../workspace-home/workspace-preferences-store";

import "./workspace-navigation.css";

type NavRoute = { href: string; label: string };

type NavGroup = {
  id: string;
  label: string;
  collapsible: boolean;
  routes: readonly NavRoute[];
};

/**
 * Sidebar structure (Recovery Task 33 — Workspace UX Evolution, Part 3).
 * Author Access Pack 04 / Publishing Workspace Pack 05 — one evolving entry:
 * Become an Author → /workspace/authoring; Publishing → /workspace/publishing.
 * Editorial Review Pack 06 — Editors/Administrators also see Editorial Review.
 */
function buildWorkspaceNavGroups(
  authoringRoute: NavRoute,
  editorialRoute: NavRoute | null,
): readonly NavGroup[] {
  const civicRoutes: NavRoute[] = [
    { href: "/civic-activity", label: "My Civic Activity" },
    { href: "/workspace/initiatives", label: "Initiatives" },
    { href: "/workspace/messages", label: "Messages" },
    authoringRoute,
  ];
  if (editorialRoute) {
    civicRoutes.push(editorialRoute);
  }

  return [
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
    {
      id: "public-profile",
      label: "Public Profile",
      collapsible: false,
      routes: [{ href: "/profile", label: "View Public Profile" }],
    },
  ];
}

function isRouteActive(pathname: string, href: string): boolean {
  if (href === "/workspace") {
    return pathname === "/workspace";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

interface WorkspaceNavigationProps {
  /**
   * PWA UX Pack 03 addendum — called when a destination link is activated
   * (e.g. close the mobile Workspace Drawer). Desktop callers omit this.
   */
  onNavigate?: () => void;
}

export function WorkspaceNavigation({ onNavigate }: WorkspaceNavigationProps) {
  const pathname = usePathname();
  /**
   * Launch Readiness Pack 05 — read collapsed groups during the initial client
   * render so `aria-expanded` does not flip after hydration. SSR stays expanded
   * (empty array) because localStorage is unavailable on the server.
   */
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }
    return getCollapsedNavigationGroups();
  });
  const [authoringRoute, setAuthoringRoute] = useState<NavRoute>({
    href: "/workspace/authoring",
    label: "Become an Author",
  });
  const [editorialRoute, setEditorialRoute] = useState<NavRoute | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetchBlogAuthoringAccessState()
      .then((state) => {
        if (cancelled) {
          return;
        }
        setAuthoringRoute({
          href: state.publishingWorkspaceHref ?? "/workspace/authoring",
          label: state.navLabel,
        });
        setEditorialRoute(
          state.editorialReviewHref
            ? { href: state.editorialReviewHref, label: "Editorial Review" }
            : null,
        );
      })
      .catch(() => {
        if (!cancelled) {
          setAuthoringRoute({
            href: "/workspace/authoring",
            label: "Become an Author",
          });
          setEditorialRoute(null);
        }
      });

    return () => {
      cancelled = true;
    };
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

  const groups = buildWorkspaceNavGroups(authoringRoute, editorialRoute);

  return (
    <nav className="workspace-navigation" aria-label="Main workspace navigation">
      <WorkspaceMemberIdentity />
      <div className="workspace-navigation__groups">
        {groups.map((group, index) => {
          const collapsed = group.collapsible && collapsedGroups.includes(group.id);

          return (
            <div key={group.id} className="workspace-navigation__group">
              {index > 0 ? <div className="workspace-navigation__divider" role="separator" /> : null}
              {group.collapsible ? (
                <button
                  type="button"
                  className="workspace-navigation__group-toggle"
                  aria-expanded={!collapsed}
                  aria-controls={`workspace-nav-group-${group.id}`}
                  onClick={() => toggleGroup(group.id)}
                >
                  <span>{group.label}</span>
                  <span
                    className={`workspace-navigation__group-chevron${collapsed ? " workspace-navigation__group-chevron--collapsed" : ""}`}
                    aria-hidden="true"
                  >
                    ▾
                  </span>
                </button>
              ) : (
                <p className="workspace-navigation__label">{group.label}</p>
              )}
              <div
                id={`workspace-nav-group-${group.id}`}
                className="workspace-navigation__list"
                hidden={collapsed}
              >
                {group.routes.map((route) => {
                  const active = isRouteActive(pathname, route.href);

                  return (
                    <Link
                      key={route.href}
                      className={`workspace-navigation__link${active ? " workspace-navigation__link--active" : ""}`}
                      href={route.href}
                      aria-current={active ? "page" : undefined}
                      tabIndex={collapsed ? -1 : undefined}
                      onClick={onNavigate}
                    >
                      {route.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
