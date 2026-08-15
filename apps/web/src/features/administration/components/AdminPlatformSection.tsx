"use client";

import { useEffect, useState } from "react";

import type { AuthUserPublic, PlatformConfigPublic } from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";
import { ProfileSection } from "../../../components/member/ProfileSection";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { getPlatformConfig } from "../../closed-beta/platform-api";
import { AdminPanelNavigation } from "./AdminPanelNavigation";

import "./admin-panel.css";

interface AdminPlatformSectionProps {
  user: AuthUserPublic;
}

export function AdminPlatformSection({ user: _user }: AdminPlatformSectionProps) {
  const [platform, setPlatform] = useState<PlatformConfigPublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void getPlatformConfig()
      .then((config) => {
        if (!cancelled) {
          setPlatform(config);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPlatform(null);
          setError("Platform configuration is temporarily unavailable.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="admin-panel">
      <AdminPanelNavigation />

      <ProfileSection title="Platform configuration">
        {loading ? <p className="hu-body">Loading platform configuration…</p> : null}
        {error ? <StatusBanner title="Platform unavailable" message={error} /> : null}
        {platform ? (
          <>
            <ProfileField label="Platform mode" value={platform.platformMode} />
            <ProfileField
              label="Registration requires invite"
              value={platform.registrationRequiresInvite ? "Yes" : "No"}
            />
            <ProfileField
              label="Beta banner visible"
              value={platform.showBetaBanner ? "Yes" : "No"}
            />
            <ProfileField label="Beta banner message" value={platform.betaBannerMessage} />
          </>
        ) : null}
      </ProfileSection>

      <ProfileSection title="Capability grants (gap)">
        <p className="hu-body">
          Administration Foundation services can grant/revoke platform capabilities and map
          JWT admin roles to capabilities such as `platform.admin` and
          `beta.invite.manage`, but there is no Web-consumable HTTP console for capability
          inventory yet. Follow-up: narrow admin-authorized list/grant routes if a
          Capability Console is required.
        </p>
      </ProfileSection>
    </div>
  );
}
