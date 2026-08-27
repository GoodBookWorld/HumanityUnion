"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { AuthUserPublic } from "@hu/types";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { formatAuthFormError, isForbiddenError } from "../../../lib/api-client";
import { resolveAdminParticipantPublicProfile } from "../admin-participant-directory-api";

interface AdminParticipantPublicProfileRedirectProps {
  user: AuthUserPublic;
  participantId: string;
}

/**
 * Pack 24A — Admin-only bridge: stable participantId → CURRENT `/member/{publicName}`.
 * Never navigates using Member.uniqueName or a stale directory slug.
 */
export function AdminParticipantPublicProfileRedirect({
  user: _user,
  participantId,
}: AdminParticipantPublicProfileRedirectProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void resolveAdminParticipantPublicProfile(participantId)
      .then((resolved) => {
        if (cancelled) {
          return;
        }
        if (!resolved.publicHref.startsWith("/member/")) {
          setUnavailable(true);
          return;
        }
        router.replace(resolved.publicHref);
      })
      .catch((caught: unknown) => {
        if (cancelled) {
          return;
        }
        if (isForbiddenError(caught)) {
          setDenied(true);
          setError("Administrator access is required.");
          return;
        }
        const message = formatAuthFormError(caught);
        if (/not found|not currently available|public profile/i.test(message)) {
          setUnavailable(true);
          setError(message);
          return;
        }
        setError(message);
      });

    return () => {
      cancelled = true;
    };
  }, [participantId, router]);

  if (denied) {
    return (
      <StatusBanner title="Access restricted" message={error ?? "Administrator access is required."} />
    );
  }

  if (unavailable) {
    return (
      <div className="admin-panel">
        <ProfileSection title="Public profile">
          <StatusBanner
            title="Profile unavailable"
            message={
              error ??
              "A public profile is not currently available for this Participant."
            }
          />
          <p className="hu-body">
            <Link className="admin-panel__link" href="/admin/participants">
              Back to Participants
            </Link>
          </p>
        </ProfileSection>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-panel">
        <ProfileSection title="Public profile">
          <StatusBanner title="Unable to open profile" message={error} />
          <p className="hu-body">
            <Link className="admin-panel__link" href="/admin/participants">
              Back to Participants
            </Link>
          </p>
        </ProfileSection>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <ProfileSection title="Public profile">
        <p className="hu-body">Opening current public profile…</p>
      </ProfileSection>
    </div>
  );
}
