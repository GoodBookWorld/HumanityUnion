/**
 * Pack 08K.2.8 — residual identity CLI parsing (no language barrel).
 */

import type { ContentTranslationSourceKind, LanguageCode } from "@hu/types";

export type ThinResidualIdentity = {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  readonly targetLocale: LanguageCode;
};

const KNOWN_SOURCE_KINDS = new Set<string>([
  "initiative",
  "collaborative_analysis",
  "petition",
  "lifecycle_stage",
  "blog_post",
  "discussion_comment",
  "improvement_proposal",
  "initiative_revision",
  "decision_session",
  "collective_decision",
  "implementation_commitment",
  "implementation_tracking",
  "official_response",
  "public_impact",
  "civic_archive",
  "civic_media",
]);

export function parseThinResidualIdentityArg(
  raw: string,
): ThinResidualIdentity | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const parts = trimmed.split(":");
  if (parts.length < 3) {
    return null;
  }
  const sourceKind = parts[0]!.trim();
  const targetLocale = parts[parts.length - 1]!.trim();
  const sourceRecordId = parts.slice(1, -1).join(":").trim();
  if (!KNOWN_SOURCE_KINDS.has(sourceKind) || !sourceRecordId || !targetLocale) {
    return null;
  }
  return {
    sourceKind: sourceKind as ContentTranslationSourceKind,
    sourceRecordId,
    targetLocale: targetLocale as LanguageCode,
  };
}

export function parseThinResidualIdentityArgs(
  argv: readonly string[],
): readonly ThinResidualIdentity[] {
  const out: ThinResidualIdentity[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--residual") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) {
        continue;
      }
      const parsed = parseThinResidualIdentityArg(value);
      if (parsed) {
        const key = `${parsed.sourceKind}::${parsed.sourceRecordId}::${parsed.targetLocale}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push(parsed);
        }
      }
      i += 1;
      continue;
    }
    if (arg?.startsWith("--residual=")) {
      const parsed = parseThinResidualIdentityArg(arg.slice("--residual=".length));
      if (parsed) {
        const key = `${parsed.sourceKind}::${parsed.sourceRecordId}::${parsed.targetLocale}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push(parsed);
        }
      }
    }
  }
  return out;
}
