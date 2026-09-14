/**
 * Localization Authority Closure 05 — lightweight Media HU-owned localization
 * integrity diagnostic (Registry-driven; no provider; no full corpus hydrate).
 *
 * For every Language Registry locale with enabled ∩ contentTranslationEnabled,
 * classify civic_media_editorial PLP CURRENT usability. Excludes public_news/RSS.
 */

import {
  MEDIA_PLP_ENTITY_TYPE,
  MEDIA_PLP_EDITORIAL_ENTITY_ID,
  mediaPlpEditorialEntityId,
  type LanguageCode,
} from "@hu/types";

import {
  CIVIC_MEDIA_FAQ,
  CIVIC_MEDIA_OVERVIEW,
} from "../civic-media-center/content/sections.js";
import { listAutomaticContentTranslationTargetLocales } from "./content-translation-warm-targets.js";
import {
  asMediaPlpPresentationNode,
  buildCanonicalEditorialPresentation,
  fingerprintMediaPlpCanonicalVersion,
} from "./published-localized-presentation/media/canonical-trees.js";
import { findCurrentPublishedPresentation } from "./published-localized-presentation/persistence/repository.js";
import { classifyUsableLocalizedPresentation } from "./published-localized-presentation/usability.js";

export type MediaHuLocalizationIntegrityStatus =
  | "CURRENT_PUBLISHED_COMPLETE"
  | "MISSING"
  | "STALE"
  | "FAILED"
  | "PENDING";

export type MediaHuLocalizationIntegrityRow = {
  readonly locale: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly status: MediaHuLocalizationIntegrityStatus;
};

export type MediaHuLocalizationIntegrityReport = {
  readonly pack: "closure05";
  readonly operation: "media_hu_localization_integrity";
  readonly mode: "read-only";
  readonly PROVIDER_CALLS: 0;
  readonly WRITES_PERFORMED: 0;
  readonly registryTargetLocales: readonly string[];
  readonly rows: readonly MediaHuLocalizationIntegrityRow[];
};

/**
 * Lightweight integrity scan for Media HU-owned editorial PLP snapshots.
 * Does not call providers or enqueue work.
 */
export async function runMediaHuOwnedLocalizationIntegrityCheck(): Promise<MediaHuLocalizationIntegrityReport> {
  const registryTargetLocales = [
    ...(await listAutomaticContentTranslationTargetLocales({
      excludeSourceLanguage: "en",
    })),
  ];

  const tree = asMediaPlpPresentationNode(
    buildCanonicalEditorialPresentation({
      overview: CIVIC_MEDIA_OVERVIEW,
      faq: [...CIVIC_MEDIA_FAQ],
    }),
  );
  const liveCanonicalVersion = fingerprintMediaPlpCanonicalVersion(tree);
  const entityType = MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL;
  const entityId = mediaPlpEditorialEntityId(MEDIA_PLP_EDITORIAL_ENTITY_ID);

  const rows: MediaHuLocalizationIntegrityRow[] = [];
  for (const locale of registryTargetLocales) {
    const snapshot = await findCurrentPublishedPresentation({
      entityType,
      entityId,
      locale,
    });
    const usability = classifyUsableLocalizedPresentation({
      locale,
      liveCanonicalVersion,
      liveLocalizationSchemaVersion:
        snapshot?.identity.localizationSchemaVersion ??
        "published-localized-presentation-v1",
      canonicalPresentation: tree,
      snapshot,
    });

    let status: MediaHuLocalizationIntegrityStatus;
    if (!snapshot) {
      status = "MISSING";
    } else if (usability.allowPublishedLocalized) {
      status = "CURRENT_PUBLISHED_COMPLETE";
    } else if (usability.rebuildRequired) {
      status =
        snapshot.contentIntegrity?.status === "FAILED" ||
        snapshot.structuralIntegrity?.status === "FAILED"
          ? "FAILED"
          : "STALE";
    } else {
      status = "MISSING";
    }

    rows.push({
      locale,
      entityType,
      entityId,
      status,
    });
  }

  return {
    pack: "closure05",
    operation: "media_hu_localization_integrity",
    mode: "read-only",
    PROVIDER_CALLS: 0,
    WRITES_PERFORMED: 0,
    registryTargetLocales,
    rows,
  };
}

/** Convenience: classify one locale without inventing locale-specific branches. */
export async function classifyMediaEditorialLocalizationForLocale(
  locale: LanguageCode | string,
): Promise<MediaHuLocalizationIntegrityStatus> {
  const report = await runMediaHuOwnedLocalizationIntegrityCheck();
  const row = report.rows.find((entry) => entry.locale === locale);
  return row?.status ?? "MISSING";
}
