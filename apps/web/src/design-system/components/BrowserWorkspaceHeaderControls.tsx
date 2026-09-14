"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
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
 * Pack 10A — authenticated Participant avatar opens the canonical Workspace drawer.
 * Reuses `PwaWorkspaceDrawer` + `WorkspaceNavigation` (no second nav tree, no second burger).
 */
export function BrowserWorkspaceHeaderControls() {
  const authStatus = useClientAuthStatus();
  const pathname = usePathname();
  const tWorkspace = useTranslations("workspace");
  const tNav = useTranslations("navigation");
  const avatarRef = useRef<HTMLButtonElement>(null);
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
          ref={avatarRef}
          type="button"
          className="humanity-header__participant-avatar"
          aria-label={drawerOpen ? tWorkspace("closeMenu") : tWorkspace("openMenu")}
          aria-expanded={drawerOpen}
          title={tNav("workspace")}
          onClick={() => setDrawerOpen((open) => !open)}
        >
          <HumanityAvatar avatarUrl={identity?.avatarUrl} size={36} alt="" />
        </button>
      </div>
      <PwaWorkspaceDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        returnFocusRef={avatarRef}
      />
    </>
  );
}
