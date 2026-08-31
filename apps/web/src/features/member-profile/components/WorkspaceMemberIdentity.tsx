"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { HumanityAvatar } from "../../../design-system/components/HumanityAvatar";
import { isAuthenticationRequiredError } from "../../../lib/api-client";
import { getWorkspaceMemberIdentity, type WorkspaceMemberIdentity } from "../member-profile-api";
import { MEMBER_PROFILE_UPDATED_EVENT } from "../member-profile-events";

import "./workspace-member-identity.css";

export function WorkspaceMemberIdentity() {
  const tWorkspace = useTranslations("workspace");
  const [identity, setIdentity] = useState<WorkspaceMemberIdentity | null>(null);
  const [requiresLogin, setRequiresLogin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadIdentity() {
      try {
        const loaded = await getWorkspaceMemberIdentity();

        if (!cancelled) {
          setIdentity(loaded);
          setRequiresLogin(false);
        }
      } catch (error) {
        if (!cancelled) {
          setIdentity(null);
          setRequiresLogin(isAuthenticationRequiredError(error));
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
  }, []);

  if (requiresLogin) {
    return (
      <div className="workspace-member-identity workspace-member-identity--prompt">
        <p className="workspace-member-identity__label">Sign in required</p>
        <p className="workspace-member-identity__copy">
          <a href="/login">Log in</a> or <a href="/register">create an account</a> to use workspace
          features.
        </p>
      </div>
    );
  }

  if (!identity) {
    return null;
  }

  return (
    <div className="workspace-member-identity">
      <div className="workspace-member-identity__row">
        <HumanityAvatar
          className="workspace-member-identity__avatar"
          avatarUrl={identity.avatarUrl}
          size={48}
        />
        <div className="workspace-member-identity__details">
          <p className="workspace-member-identity__name">{identity.displayName}</p>
          {identity.community || identity.region || identity.country ? (
            <p className="workspace-member-identity__meta">
              {[identity.community, identity.region, identity.country].filter(Boolean).join(", ")}
            </p>
          ) : null}
        </div>
      </div>
      <Link className="workspace-member-identity__edit-link" href="/member">
        {tWorkspace("editProfile")}
      </Link>
    </div>
  );
}
