import Link from "next/link";

import type { PublicMemberProfile } from "@hu/types";

import { ApiRequestError } from "../../../lib/api-client";
import { getPublicMemberProfileByPublicName } from "../../../features/member-profile/member-profile-api";
import { ParticipantProfileSurface } from "../../../features/member-profile/components/ParticipantProfileSurface";

import "../../../features/member-profile/components/participant-profile-surface.css";

interface PublicMemberPageProps {
  params: Promise<{
    uniqueName: string;
  }>;
}

/**
 * UX Evolution Pack 02.4 Part 6 root-cause fix.
 * Profile UX Pack 02 Parts 6-9 — full redesign: identity/statistics top
 * row, full-width Biography, 50/50 Skills/Professional Links, and a
 * "Recent Public Initiatives" compact list. Resolves by publicName via
 * member-profile.
 * Profile UX Pack 03.2 — centered container, 50/50 top row through tablet,
 * equal-height identity/statistics cards, and three horizontal statistic
 * cards (reusing the shared `personal-statistics__*` card visuals).
 * Profile UX Pack 03.3 — the profile content itself now renders through the
 * shared `ParticipantProfileSurface` (`mode="public"`), also used by
 * `/profile`'s owner-preview. This route keeps only what is genuinely
 * route-specific: resolving the profile, the `<main>` landmark, and the
 * not-found / restricted / "Back to Home" states a signed-in owner
 * previewing their own profile never needs.
 */
type PublicMemberPageState =
  | { status: "found"; profile: PublicMemberProfile }
  | { status: "not_found" }
  | { status: "restricted" };

async function loadPublicMemberProfile(publicName: string): Promise<PublicMemberPageState> {
  try {
    const profile = await getPublicMemberProfileByPublicName(publicName);
    return { status: "found", profile };
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 403) {
      return { status: "restricted" };
    }

    return { status: "not_found" };
  }
}

export default async function PublicMemberPage({ params }: PublicMemberPageProps) {
  const { uniqueName: publicName } = await params;
  const state = await loadPublicMemberProfile(publicName);

  if (state.status === "restricted") {
    return (
      <main className="public-member-page">
        <h1>Public Profile</h1>
        <p>This profile is only visible to signed-in Participants.</p>
        <p className="public-member-page__back">
          <Link href="/">Back to Home</Link>
        </p>
      </main>
    );
  }

  if (state.status === "not_found") {
    return (
      <main className="public-member-page">
        <h1>Public Profile</h1>
        <p>This Participant profile is not available.</p>
        <p className="public-member-page__back">
          <Link href="/">Back to Home</Link>
        </p>
      </main>
    );
  }

  return (
    <main>
      <ParticipantProfileSurface
        mode="public"
        profile={state.profile}
        footer={
          <p className="public-member-page__back">
            <Link href="/">Back to Home</Link>
          </p>
        }
      />
    </main>
  );
}
