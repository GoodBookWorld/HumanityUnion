/**
 * Pack 08K.3.1 — civic_media editorial → PublicLocalizedPresentation adapter.
 * Principles + trusted explanations are AUTO_TRANSLATABLE nested semantic content.
 * Outlet names / URLs remain protectedIdentity / protectedTechnical.
 */

import type {
  CivicMediaCenterPublic,
  CivicMediaSelectionPrinciple,
  TrustedMediaResource,
} from "@hu/types";
import {
  PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
  protectedIdentity,
  protectedTechnical,
  type PublicLocalizedPresentation,
  type PublicPresentationNode,
} from "@hu/types";

import {
  collectAutoTranslatableNodes,
  localizePublicPresentation,
} from "../public-localized-presentation.js";

export type CivicMediaPrinciplePresentationTree = {
  readonly title: string;
  readonly description: string;
};

export type CivicMediaTrustedCardPresentationTree = {
  readonly name: PublicPresentationNode;
  readonly websiteUrl: PublicPresentationNode;
  readonly explanation: string;
  readonly extensions?: Record<string, PublicPresentationNode>;
};

export function buildCivicMediaPrinciplePresentation(
  principle: CivicMediaSelectionPrinciple,
): CivicMediaPrinciplePresentationTree {
  return {
    title: principle.title,
    description: principle.description,
  };
}

export function buildCivicMediaTrustedCardPresentation(
  resource: TrustedMediaResource,
  explanation?: string,
): CivicMediaTrustedCardPresentationTree {
  return {
    name: protectedIdentity(resource.name),
    websiteUrl: protectedTechnical(resource.websiteUrl),
    explanation: explanation ?? resource.explanation,
  };
}

export function localizeCivicMediaPrinciplePresentation(input: {
  readonly mediaRecordId: string;
  readonly principleId: string;
  readonly principle: CivicMediaSelectionPrinciple;
  readonly targetLanguage: string;
  readonly sourceLanguage?: string;
  readonly translations?: Readonly<Record<string, string>>;
}): PublicLocalizedPresentation {
  const presentation = buildCivicMediaPrinciplePresentation(
    input.principle,
  ) as unknown as PublicPresentationNode;
  return localizePublicPresentation({
    identity: {
      sourceKind: "civic_media",
      sourceRecordId: `${input.mediaRecordId}::principle::${input.principleId}`,
      presentationSchemaVersion: PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
    },
    sourceLanguage: input.sourceLanguage ?? "en",
    targetLanguage: input.targetLanguage,
    presentation,
    translations: input.translations,
  });
}

export function localizeCivicMediaTrustedCardPresentation(input: {
  readonly mediaRecordId: string;
  readonly resource: TrustedMediaResource;
  readonly explanation?: string;
  readonly targetLanguage: string;
  readonly sourceLanguage?: string;
  readonly translations?: Readonly<Record<string, string>>;
  readonly extensions?: Record<string, PublicPresentationNode>;
}): PublicLocalizedPresentation {
  const tree = buildCivicMediaTrustedCardPresentation(
    input.resource,
    input.explanation,
  );
  const presentation = {
    ...tree,
    ...(input.extensions ? { extensions: input.extensions } : {}),
  } as unknown as PublicPresentationNode;
  return localizePublicPresentation({
    identity: {
      sourceKind: "civic_media",
      sourceRecordId: `${input.mediaRecordId}::trusted::${input.resource.id}`,
      presentationSchemaVersion: PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
    },
    sourceLanguage: input.sourceLanguage ?? "en",
    targetLanguage: input.targetLanguage,
    presentation,
    translations: input.translations,
  });
}

/** Deterministic fixture helper: prefix every auto node with [locale]. */
export function buildCompleteCivicMediaCardFixtureTranslations(
  presentation: PublicPresentationNode,
  targetLanguage: string,
): Record<string, string> {
  const translations: Record<string, string> = {};
  for (const node of collectAutoTranslatableNodes(presentation)) {
    translations[node.path] = `[${targetLanguage}] ${node.value}`;
  }
  return translations;
}

/** Inventory helper — principles + trusted cards from a civic_media public payload. */
export function buildCivicMediaFamilyPresentations(input: {
  readonly media: CivicMediaCenterPublic;
  readonly mediaRecordId: string;
  readonly targetLanguage: string;
  readonly principleTranslations?: ReadonlyArray<Readonly<Record<string, string>>>;
  readonly trustedTranslationsById?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly trustedExplanationsById?: Readonly<Record<string, string>>;
}): PublicLocalizedPresentation[] {
  const out: PublicLocalizedPresentation[] = [];
  input.media.selectionPrinciples.forEach((principle, index) => {
    out.push(
      localizeCivicMediaPrinciplePresentation({
        mediaRecordId: input.mediaRecordId,
        principleId: `p${index}`,
        principle,
        targetLanguage: input.targetLanguage,
        translations: input.principleTranslations?.[index],
      }),
    );
  });
  for (const resource of input.media.trustedMedia) {
    out.push(
      localizeCivicMediaTrustedCardPresentation({
        mediaRecordId: input.mediaRecordId,
        resource,
        explanation: input.trustedExplanationsById?.[resource.id],
        targetLanguage: input.targetLanguage,
        translations: input.trustedTranslationsById?.[resource.id],
      }),
    );
  }
  return out;
}
