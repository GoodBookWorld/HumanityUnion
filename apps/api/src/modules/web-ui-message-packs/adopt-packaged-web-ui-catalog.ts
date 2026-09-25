/**
 * Step 15D.12.4 — Adopt a packaged locale WEB_UI catalog into canonical published authority.
 *
 * Universal for any Registry locale. No allowlist. Zero provider calls on success.
 * Packaged assets are adoption source material only — not a second runtime translation system.
 */

import type { WebUiMessageTree } from "@hu/types";

import { assessWebUiMessageTreeReadiness } from "../language/language-localization-activation/assess-web-ui-catalog-readiness.js";
import {
  assertCompletePublicWebUiDraft,
  hashWebUiEnglishFlatMap,
  loadPublicWebUiEnglishCorpus,
} from "./web-ui-draft-builder.js";
import { loadPackagedWebUiCatalog } from "./packaged-web-ui-catalog.js";
import { upsertWebUiMessagePack } from "./web-ui-message-pack.repository.js";
import { validateWebUiMessageTreeAgainstEnglish } from "./web-ui-message-pack.validate.js";

export type AdoptPackagedWebUiCatalogDeps = {
  readonly loadPackagedWebUiCatalog?: (locale: string) => WebUiMessageTree | null;
  readonly includePaths?: readonly string[];
};

export type AdoptPackagedWebUiCatalogResult =
  | {
      readonly outcome: "adopted";
      readonly sourceHash: string;
      readonly publicDataReady: true;
      readonly participantDataReady: true;
    }
  | { readonly outcome: "absent" }
  | { readonly outcome: "rejected"; readonly reason: string };

/**
 * Validate a packaged catalog against the current English ordinary corpus and,
 * when fully valid, publish it as the canonical WEB_UI pack for the locale.
 */
export async function tryAdoptPackagedWebUiCatalog(input: {
  readonly locale: string;
  readonly generation?: number;
  readonly deps?: AdoptPackagedWebUiCatalogDeps;
}): Promise<AdoptPackagedWebUiCatalogResult> {
  const locale = input.locale.trim();
  if (!locale) {
    return { outcome: "absent" };
  }

  const load = input.deps?.loadPackagedWebUiCatalog ?? loadPackagedWebUiCatalog;
  const packaged = load(locale);
  if (packaged == null) {
    return { outcome: "absent" };
  }

  const { flat, requiredPaths } = loadPublicWebUiEnglishCorpus(input.deps?.includePaths);
  const sourceHash = hashWebUiEnglishFlatMap(flat);

  const validation = validateWebUiMessageTreeAgainstEnglish(packaged);
  if (
    validation.rejectedUnknownPaths.length > 0 ||
    validation.rejectedNonStringPaths.length > 0 ||
    validation.placeholderMismatchPaths.length > 0 ||
    validation.emptyPaths.length > 0
  ) {
    return {
      outcome: "rejected",
      reason: "Packaged WEB_UI catalog failed structural validation against English.",
    };
  }

  try {
    assertCompletePublicWebUiDraft({ messages: packaged, requiredPaths });
  } catch (error) {
    const message = error instanceof Error ? error.message : "incomplete";
    return {
      outcome: "rejected",
      reason: `Packaged WEB_UI catalog is incomplete or invalid: ${message}`,
    };
  }

  // Authoritative readiness: full Public + Participant unless test includePaths subset.
  if (input.deps?.includePaths) {
    const subset = assessWebUiMessageTreeReadiness({
      messages: packaged,
      requiredPaths,
    });
    if (subset.dataReady !== true) {
      return {
        outcome: "rejected",
        reason:
          "Packaged WEB_UI catalog is not Public+Participant READY under authoritative contracts.",
      };
    }
  } else {
    const publicReadiness = assessWebUiMessageTreeReadiness({
      messages: packaged,
      scope: "public",
    });
    const participantReadiness = assessWebUiMessageTreeReadiness({
      messages: packaged,
      scope: "participant",
    });
    if (publicReadiness.dataReady !== true || participantReadiness.dataReady !== true) {
      return {
        outcome: "rejected",
        reason:
          "Packaged WEB_UI catalog is not Public+Participant READY under authoritative contracts.",
      };
    }
  }

  const generation = input.generation ?? 0;
  await upsertWebUiMessagePack({
    locale,
    messages: packaged,
    status: "published",
    sourceNote: `Language activation packaged catalog adoption; generation ${generation}; sourceHash=${sourceHash}`,
  });

  return {
    outcome: "adopted",
    sourceHash,
    publicDataReady: true,
    participantDataReady: true,
  };
}
