import type { Document } from "mongodb";
import type {
  LanguageActivationJobDomains,
  LanguageActivationJobRecord,
  LanguageActivationJobStatus,
} from "@hu/types";
import {
  isLanguageActivationDomainStatus,
  isLanguageActivationJobStatus,
  normalizeLanguageRegistryLocaleKey,
} from "@hu/types";

import { LanguageActivationJobValidationError } from "./language-activation-job.errors.js";

export interface LanguageActivationJobMongoDocument extends Document {
  jobId: string;
  locale: string;
  localeKey: string;
  languageId: string;
  generation: number;
  status: LanguageActivationJobStatus;
  domains: LanguageActivationJobDomains;
  lastError: string | null;
  diagnosticSummary: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  createdByParticipantId: string | null;
  searchEnabledSnapshot: boolean;
  seoIndexingEnabledSnapshot: boolean;
}

function assertDomains(value: unknown): LanguageActivationJobDomains {
  if (value == null || typeof value !== "object") {
    throw new LanguageActivationJobValidationError("Invalid activation job domains.");
  }
  const domains = value as LanguageActivationJobDomains;
  for (const key of ["webUi", "controlledVocabulary", "ct", "plp"] as const) {
    const slice = domains[key];
    if (slice == null || typeof slice !== "object") {
      throw new LanguageActivationJobValidationError(`Invalid domain slice: ${key}`);
    }
    if (!isLanguageActivationDomainStatus(slice.status)) {
      throw new LanguageActivationJobValidationError(`Invalid domain status: ${key}`);
    }
  }
  return domains;
}

export function toLanguageActivationJobMongoDocument(
  record: LanguageActivationJobRecord,
): LanguageActivationJobMongoDocument {
  return {
    jobId: record.jobId,
    locale: record.locale,
    localeKey: normalizeLanguageRegistryLocaleKey(record.locale),
    languageId: record.languageId,
    generation: record.generation,
    status: record.status,
    domains: record.domains,
    lastError: record.lastError,
    diagnosticSummary: record.diagnosticSummary,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    createdByParticipantId: record.createdByParticipantId,
    searchEnabledSnapshot: record.searchEnabledSnapshot,
    seoIndexingEnabledSnapshot: record.seoIndexingEnabledSnapshot,
  };
}

export function fromLanguageActivationJobMongoDocument(
  doc: LanguageActivationJobMongoDocument,
): LanguageActivationJobRecord {
  if (!isLanguageActivationJobStatus(doc.status)) {
    throw new LanguageActivationJobValidationError(
      `Invalid activation job status on ${doc.jobId}.`,
    );
  }
  return {
    jobId: doc.jobId,
    locale: doc.locale,
    languageId: doc.languageId,
    generation: doc.generation,
    status: doc.status,
    domains: assertDomains(doc.domains),
    lastError: doc.lastError ?? null,
    diagnosticSummary: doc.diagnosticSummary ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    startedAt: doc.startedAt ?? null,
    completedAt: doc.completedAt ?? null,
    createdByParticipantId: doc.createdByParticipantId ?? null,
    searchEnabledSnapshot: doc.searchEnabledSnapshot === true,
    seoIndexingEnabledSnapshot: doc.seoIndexingEnabledSnapshot === true,
  };
}
