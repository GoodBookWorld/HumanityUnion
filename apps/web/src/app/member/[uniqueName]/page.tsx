import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import type { PublicMemberProfile } from "@hu/types";

import { ApiRequestError } from "../../../lib/api-client";
import { getPublicMemberProfileByPublicName } from "../../../features/member-profile/member-profile-api";
import { ParticipantProfileSurface } from "../../../features/member-profile/components/ParticipantProfileSurface";
import { resolveMediaUrl } from "../../../features/media-upload/media-url";
import { buildPublicPageMetadata } from "../../../lib/seo/build-public-page-metadata";
import {
  buildParticipantProfilePageDescription,
  buildUnavailablePublicMetadata,
} from "../../../lib/seo/public-surface-copy";
import { JsonLdScript, buildProfilePageJsonLd } from "../../../lib/seo/structured-data";

import "../../../features/member-profile/components/participant-profile-surface.css";

interface PublicMemberPageProps {
  params: Promise<{
    uniqueName: string;
  }>;
}

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

function collectPublicSameAs(profile: PublicMemberProfile): string[] {
  return [
    profile.website,
    profile.linkedinUrl,
    profile.facebookUrl,
    profile.youtubeUrl,
    profile.instagramUrl,
    profile.xUrl,
  ].filter((value): value is string => Boolean(value?.trim() && /^https?:\/\//i.test(value.trim())));
}

export async function generateMetadata({ params }: PublicMemberPageProps): Promise<Metadata> {
  const { uniqueName: publicName } = await params;
  const state = await loadPublicMemberProfile(publicName);

  if (state.status === "restricted") {
    return buildUnavailablePublicMetadata("Public Profile | Humanity Union");
  }

  if (state.status === "not_found") {
    return buildUnavailablePublicMetadata("Participant not found | Humanity Union");
  }

  const profile = state.profile;
  const displayName = profile.displayName?.trim() || profile.publicName;
  const description = buildParticipantProfilePageDescription({
    publicName: profile.publicName,
    displayName: profile.displayName,
    biography: profile.biography,
    organization: profile.organization,
  });
  const imageUrl = resolveMediaUrl(profile.avatarUrl);

  return buildPublicPageMetadata({
    title: `${displayName} — Participant`,
    description,
    canonicalPath: `/member/${encodeURIComponent(profile.publicName)}`,
    socialTitle: displayName,
    socialDescription: description,
    imageUrl,
    imageAlt: displayName,
    openGraphType: "profile",
  });
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
export default async function PublicMemberPage({ params }: PublicMemberPageProps) {
  const t = await getTranslations("participantPublic");
  const { uniqueName: publicName } = await params;
  const state = await loadPublicMemberProfile(publicName);

  if (state.status === "restricted" || state.status === "not_found") {
    return (
      <main className="public-member-page">
        <h1>{t("empty.unavailableTitle")}</h1>
        <p>{t("empty.unavailableBody")}</p>
        <p className="public-member-page__back">
          <Link href="/">{t("empty.backHome")}</Link>
        </p>
      </main>
    );
  }

  const profile = state.profile;
  const displayName = profile.displayName?.trim() || profile.publicName;
  const description = buildParticipantProfilePageDescription({
    publicName: profile.publicName,
    displayName: profile.displayName,
    biography: profile.biography,
    organization: profile.organization,
  });
  const canonicalPath = `/member/${encodeURIComponent(profile.publicName)}`;
  const structuredData = buildProfilePageJsonLd({
    name: displayName,
    description,
    canonicalPath,
    imageUrl: resolveMediaUrl(profile.avatarUrl),
    organization: profile.organization,
    sameAs: collectPublicSameAs(profile),
  });

  return (
    <main>
      <JsonLdScript data={structuredData} />
      <ParticipantProfileSurface
        mode="public"
        profile={profile}
        footer={
          <p className="public-member-page__back">
            <Link href="/">{t("empty.backHome")}</Link>
          </p>
        }
      />
    </main>
  );
}
