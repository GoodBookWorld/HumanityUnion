"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useClientAuthStatus } from "../../features/auth/use-client-auth-status";
import {
  getWorkspaceMemberIdentity,
  type WorkspaceMemberIdentity,
} from "../../features/member-profile/member-profile-api";
import { MEMBER_PROFILE_UPDATED_EVENT } from "../../features/member-profile/member-profile-events";
import { PwaWorkspaceDrawer } from "../../features/pwa/components/PwaWorkspaceDrawer";
import { HumanityAvatar } from "./HumanityAvatar";

/**
 * Mobile Shell Pack 09C — browser tablet/mobile Workspace access.
 * Reuses `PwaWorkspaceDrawer` + canonical `WorkspaceNavigation` (no second nav tree).
 * Avatar → `/workspace`. Menu trigger → left Workspace drawer.
 */
export function BrowserWorkspaceHeaderControls() {
  const authStatus = useClientAuthStatus();
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [identity, setIdentity] = useState<WorkspaceMemberIdentity | null>(null);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      setIdentity(null);
      return;
    }

    let cancelled = false;

    async function loadIdentity() {
      try {
        const loaded = await getWorkspaceMemberIdentity();
        if (!cancelled) {
          setIdentity(loaded);
        }
      } catch {
        if (!cancelled) {
          setIdentity(null);
        }
      }
    }

    void loadIdentity();

    function handleProfileUpdated() {
      void loadIdentity();
    }

    window.addEventListener(MEMBER_PROFILE_UPDATED_EVENT, handleProfileUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener(MEMBER_PROFILE_UPDATED_EVENT, handleProfileUpdated);
    };
  }, [authStatus]);

  if (authStatus !== "authenticated") {
    return null;
  }

  return (
    <>
      <div className="humanity-header__workspace-shell">
        <button
          ref={triggerRef}
          type="button"
          className="humanity-header__workspace-trigger"
          aria-label={drawerOpen ? "Close Workspace navigation" : "Open Workspace navigation"}
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen((open) => !open)}
        >
          <span className="humanity-header__workspace-trigger-glyph" aria-hidden="true">
            ☰
          </span>
        </button>
        <Link
          href="/workspace"
          className="humanity-header__participant-avatar"
          aria-label="Workspace"
          title="Workspace"
        >
          <HumanityAvatar avatarUrl={identity?.avatarUrl} size={36} alt="" />
        </Link>
      </div>
      <PwaWorkspaceDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        returnFocusRef={triggerRef}
      />
    </>
  );
}
