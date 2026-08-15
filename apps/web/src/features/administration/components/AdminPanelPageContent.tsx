"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { AuthUserPublic, PlatformConfigPublic } from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";
import { ProfileSection } from "../../../components/member/ProfileSection";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { getMe } from "../../auth/auth-api";
import { getPlatformConfig } from "../../closed-beta/platform-api";
import {
  formatAuthFormError,
  isAuthenticationRequiredError,
  isForbiddenError,
} from "../../../lib/api-client";
import { isAdminAccountRole } from "../is-admin-role";

import "./admin-panel.css";

/**
 * Admin Panel foundation — authorization is enforced here via server-backed
 * `getMe()` role, independent of Workspace nav visibility.
 */
export function AdminPanelPageContent() {
  const [user, setUser] = useState<AuthUserPublic | null>(null);
  const [platform, setPlatform] = useState<PlatformConfigPublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const currentUser = await getMe();

        if (cancelled) {
          return;
        }

        if (!isAdminAccountRole(currentUser.role)) {
          setDenied(true);
          setError("The Admin Panel is available to Administrators only.");
          setUser(null);
          setLoading(false);
          return;
        }

        setUser(currentUser);

        try {
          const config = await getPlatformConfig();
          if (!cancelled) {
            setPlatform(config);
          }
        } catch {
          if (!cancelled) {
            setPlatform(null);
          }
        }
      } catch (loadError: unknown) {
        if (cancelled) {
          return;
        }

        if (isAuthenticationRequiredError(loadError)) {
          setError("Sign in to open the Admin Panel.");
        } else if (isForbiddenError(loadError)) {
          setDenied(true);
          setError("The Admin Panel is available to Administrators only.");
        } else {
          setError(formatAuthFormError(loadError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="hu-body">Loading Admin Panel…</p>;
  }

  if (error || !user) {
    return (
      <StatusBanner
        title={denied ? "Access restricted" : "Admin Panel unavailable"}
        message={error ?? "Unable to load the Admin Panel."}
      />
    );
  }

  return (
    <div className="admin-panel">
      <ProfileSection title="Administrator">
        <ProfileField label="Display name" value={user.displayName} />
        <ProfileField label="Email" value={user.email} />
        <ProfileField label="Role" value={user.role} />
        <ProfileField label="User ID" value={user.userId} />
        <ProfileField label="Participant / Member ID" value={user.memberId} />
        <ProfileField label="Account status" value={user.status} />
      </ProfileSection>

      <ProfileSection title="Platform / Administration status">
        <ProfileField
          label="Platform mode"
          value={platform?.platformMode ?? "Unavailable"}
        />
        <ProfileField
          label="Registration requires invite"
          value={
            platform
              ? platform.registrationRequiresInvite
                ? "Yes"
                : "No"
              : "Unavailable"
          }
        />
        <ProfileField
          label="Beta banner"
          value={
            platform ? (platform.showBetaBanner ? "Visible" : "Hidden") : "Unavailable"
          }
        />
        <p className="hu-caption admin-panel__note">
          Platform administration services (capability grants, audit) exist on the API
          without Web-consumable admin console routes yet. This foundation uses existing
          auth and platform config only.
        </p>
      </ProfileSection>

      <ProfileSection title="Available administration surfaces">
        <ul className="admin-panel__links">
          <li>
            <Link className="admin-panel__link" href="/workspace/editorial">
              Publishing / Editorial Review
            </Link>
            <span className="hu-caption"> — existing editorial queue for Editors and Administrators</span>
          </li>
        </ul>
      </ProfileSection>

      <ProfileSection title="Participants" placeholder />
      <ProfileSection title="Initiatives" placeholder />
      <ProfileSection title="Beta Access" placeholder />
      <ProfileSection title="Platform Capabilities" placeholder />
      <ProfileSection title="Audit" placeholder />
    </div>
  );
}
