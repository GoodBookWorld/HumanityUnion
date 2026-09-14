import type {
  TerminologyConcept,
  TerminologyConceptCategory,
  TerminologyConceptLinkedRefs,
  TerminologyConceptStatus,
  TerminologyLocaleTranslation,
} from "@hu/types";
import {
  isTerminologyConceptCategory,
  isTerminologyConceptStatus,
} from "@hu/types";

import { TerminologyGlossaryValidationError } from "./terminology-glossary.errors.js";

export interface TerminologyGlossaryMongoDocument {
  conceptId: string;
  canonicalEnglishTerm: string;
  category: TerminologyConceptCategory;
  linkedRefs?: TerminologyConceptLinkedRefs;
  translations: Record<string, TerminologyLocaleTranslation>;
  status: TerminologyConceptStatus;
  createdAt: string;
  updatedAt: string;
  updatedByParticipantId?: string | null;
}

function cloneTranslations(
  translations: Readonly<Record<string, TerminologyLocaleTranslation>>,
): Record<string, TerminologyLocaleTranslation> {
  const result: Record<string, TerminologyLocaleTranslation> = {};
  for (const [locale, translation] of Object.entries(translations)) {
    result[locale] = {
      preferredTerm: translation.preferredTerm,
      aliases: [...translation.aliases],
      ...(translation.guidance ? { guidance: translation.guidance } : {}),
    };
  }
  return result;
}

export function toTerminologyGlossaryMongoDocument(
  record: TerminologyConcept,
): TerminologyGlossaryMongoDocument {
  return {
    conceptId: record.conceptId,
    canonicalEnglishTerm: record.canonicalEnglishTerm,
    category: record.category,
    ...(record.linkedRefs ? { linkedRefs: { ...record.linkedRefs } } : {}),
    translations: cloneTranslations(record.translations),
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    updatedByParticipantId: record.updatedByParticipantId ?? null,
  };
}

export function fromTerminologyGlossaryMongoDocument(
  doc: TerminologyGlossaryMongoDocument,
): TerminologyConcept {
  if (!isTerminologyConceptCategory(doc.category)) {
    throw new TerminologyGlossaryValidationError(
      `Invalid category on terminology glossary document ${doc.conceptId}.`,
    );
  }
  if (!isTerminologyConceptStatus(doc.status)) {
    throw new TerminologyGlossaryValidationError(
      `Invalid status on terminology glossary document ${doc.conceptId}.`,
    );
  }

  return {
    conceptId: doc.conceptId,
    canonicalEnglishTerm: doc.canonicalEnglishTerm,
    category: doc.category,
    ...(doc.linkedRefs ? { linkedRefs: { ...doc.linkedRefs } } : {}),
    translations: cloneTranslations(doc.translations ?? {}),
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    updatedByParticipantId: doc.updatedByParticipantId ?? null,
  };
}
