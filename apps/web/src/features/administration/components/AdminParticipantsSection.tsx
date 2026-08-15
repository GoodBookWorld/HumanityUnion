"use client";

import { useEffect, useState } from "react";

import type { AuthUserPublic, PlatformStatisticsCounts, PlatformStatisticsMeta } from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";
import { ProfileSection } from "../../../components/member/ProfileSection";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import {
  fetchPlatformStatistics,
  formatPlatformStatisticValue,
} from "../../platform-statistics/platform-statistics-api";
import { AdminPanelNavigation } from "./AdminPanelNavigation";

import "./admin-panel.css";

interface AdminParticipantsSectionProps {
  user: AuthUserPublic;
}

/**
 * Participant directory/search APIs do not exist for admins yet.
 * Surfaces only existing platform statistics aggregates.
 */
export function AdminParticipantsSection({ user: _user }: AdminParticipantsSectionProps) {
  const [counts, setCounts] = useState<PlatformStatisticsCounts | null>(null);
  const [meta, setMeta] = useState<PlatformStatisticsMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void fetchPlatformStatistics()
      .then((response) => {
        if (!cancelled) {
          setCounts(response.data);
          setMeta(response.meta);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCounts(null);
          setMeta(null);
          setError("Platform participant statistics are temporarily unavailable.");
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

      <ProfileSection title="Participant activity">
        {loading ? <p className="hu-body">Loading participant statistics…</p> : null}
        {error ? <StatusBanner title="Statistics unavailable" message={error} /> : null}
        {counts ? (
          <>
            <ProfileField
              label="Total Participants"
              value={formatPlatformStatisticValue(counts.users)}
            />
            <ProfileField
              label="Recently active Participants"
              value={formatPlatformStatisticValue(counts.activeMembers)}
            />
            {meta ? (
              <ProfileField
                label="Active window (days)"
                value={String(meta.activeMemberWindowDays)}
              />
            ) : null}
            <ProfileField
              label="Statistics generated at"
              value={meta?.generatedAt ?? "Unavailable"}
            />
          </>
        ) : null}
        {!loading && !error && !counts ? (
          <p className="hu-body">No participant statistics available.</p>
        ) : null}
      </ProfileSection>

      <ProfileSection title="Capability gap">
        <p className="hu-body">
          There is no admin Participant directory, search, or moderation list API yet.
          Personal participant statistics exist only for the signed-in member
          (`/api/v1/member-profile/me/statistics`). Follow-up: a narrow admin-authorized
          Participant inventory endpoint if operational browsing is required.
        </p>
      </ProfileSection>
    </div>
  );
}
