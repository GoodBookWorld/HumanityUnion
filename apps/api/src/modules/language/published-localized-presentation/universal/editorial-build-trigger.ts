/**
 * RESET 05D — enqueue civic_media_editorial rebuilds for enabled auto-build locales.
 * Triggered on API bootstrap when locales are active. Durable upsert only — no provider await.
 */

import {
  MEDIA_PLP_ENTITY_TYPE,
  MEDIA_PLP_EDITORIAL_ENTITY_ID,
  mediaPlpEditorialEntityId,
} from "@hu/types";

import {
  CIVIC_MEDIA_FAQ,
  CIVIC_MEDIA_OVERVIEW,
} from "../../../civic-media-center/content/sections.js";
import {
  asMediaPlpPresentationNode,
  buildCanonicalEditorialPresentation,
  fingerprintMediaPlpCanonicalVersion,
} from "../media/canonical-trees.js";
import { enqueuePlpBuildRequest } from "./build-request-queue.js";
import { ensureMediaPlpAdapterRegistered } from "./register-defaults.js";

export async function enqueueCivicMediaEditorialPlpBuilds(input: {
  readonly locales: readonly string[];
}): Promise<{
  readonly enqueued: number;
  readonly skippedUsable: number;
  readonly deduped: number;
  readonly canonicalVersion: string;
  readonly PROVIDER_CALLS: 0;
}> {
  ensureMediaPlpAdapterRegistered();
  const tree = asMediaPlpPresentationNode(
    buildCanonicalEditorialPresentation({
      overview: CIVIC_MEDIA_OVERVIEW,
      faq: [...CIVIC_MEDIA_FAQ],
    }),
  );
  const canonicalVersion = fingerprintMediaPlpCanonicalVersion(tree);
  let enqueued = 0;
  let skippedUsable = 0;
  let deduped = 0;

  for (const locale of input.locales) {
    if (String(locale).toLowerCase() === "en") {
      continue;
    }
    const result = await enqueuePlpBuildRequest({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: mediaPlpEditorialEntityId(MEDIA_PLP_EDITORIAL_ENTITY_ID),
      locale,
      canonicalVersion,
      contentRevision: 1,
      trigger: "ADMIN_REBUILD",
      canonicalPresentation: tree,
      /** Heal stale editorial after canonical `{siteName}` fingerprint change. */
      reopenFailedSameVersion: true,
    });
    if (result.skippedUsable) {
      skippedUsable += 1;
    } else if (result.deduped) {
      deduped += 1;
    } else if (result.accepted) {
      enqueued += 1;
    }
  }

  return {
    enqueued,
    skippedUsable,
    deduped,
    canonicalVersion,
    PROVIDER_CALLS: 0,
  };
}
