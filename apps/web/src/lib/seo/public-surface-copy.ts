/**
 * SEO Pack 03 — deterministic public-surface copy for metadata descriptions.
 * Uses only known safe public fields; never invents factual claims.
 */

import { normalizeMetaDescription } from "./normalize-seo-text";

export function buildCountryPageDescription(countryName: string): string {
  const name = countryName.trim() || "this country";
  return `Explore civic activity, Participants, and Initiatives in ${name} on Humanity Union.`;
}

export function buildParticipantProfilePageDescription(input: {
  publicName: string;
  displayName?: string | null;
  biography?: string | null;
  organization?: string | null;
}): string {
  const name =
    input.displayName?.trim() ||
    input.publicName.trim() ||
    "This Participant";

  const biography = normalizeMetaDescription(input.biography, 160);
  if (biography) {
    return biography;
  }

  const organization = input.organization?.trim();
  if (organization) {
    return `${name} is a Participant with ${organization} on Humanity Union.`;
  }

  return `${name} is a Participant on Humanity Union.`;
}

export function buildPetitionPageDescription(input: {
  title: string;
  purpose?: string | null;
  summary?: string | null;
}): string {
  const fromPurpose = normalizeMetaDescription(input.purpose, 200);
  if (fromPurpose) {
    return fromPurpose;
  }

  const fromSummary = normalizeMetaDescription(input.summary, 200);
  if (fromSummary) {
    return fromSummary;
  }

  const title = input.title.trim() || "This Petition";
  return `${title} — a public Petition on Humanity Union.`;
}

/** Minimal noindex metadata for missing/non-public entities (no fabricated canonical). */
export function buildUnavailablePublicMetadata(title: string): {
  title: string;
  robots: { index: false; follow: false; nocache: true };
} {
  return {
    title,
    robots: { index: false, follow: false, nocache: true },
  };
}
