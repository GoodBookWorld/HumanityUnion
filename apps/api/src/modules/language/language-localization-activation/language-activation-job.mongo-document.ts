import type { Document } from "mongodb";
import type {
  LanguageActivationBrandDomainProgress,
  LanguageActivationJobDomains,
  LanguageActivationJobRecord,
  LanguageActivationJobStatus,
  LanguageActivationTerminologyDomainProgress,
  LanguageActivationWebUiDomainProgress,
} from "@hu/types";
import {
  isLanguageActivationDomainStatus,
  isLanguageActivationJobStatus,
  normalizeLanguageRegistryLocaleKey,
} from "@hu/types";

import { LanguageActivationJobValidationError } from "./language-activation-job.errors.js";
import { sanitizeTerminologyProviderDiagnostic } from "./terminology-activation-failure-diagnostic.js";

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

function defaultBrandDomain(): LanguageActivationBrandDomainProgress {
  return {
    status: "pending",
    preparationAttempted: false,
    fieldsPreserved: 0,
    fieldsGenerated: 0,
    fieldsFailed: 0,
    brandStatus: null,
    reviewRequired: false,
    providerFailure: false,
    detail: null,
  };
}

function defaultWebUiDomain(): LanguageActivationWebUiDomainProgress {
  return {
    status: "pending",
    dataReady: false,
    missingKeyCount: 0,
    emptyKeyCount: 0,
    requiredKeyCount: 0,
    effectiveSource: null,
    detail: null,
    preparationPhase: null,
    checkpointId: null,
    sourceHash: null,
    totalBatches: 0,
    completedBatches: 0,
    totalLeaves: 0,
    completedLeaves: 0,
    providerFailure: false,
  };
}

function defaultTerminologyDomain(): LanguageActivationTerminologyDomainProgress {
  return {
    status: "pending",
    preparationAttempted: false,
    conceptsPreserved: 0,
    conceptsGenerated: 0,
    conceptsFailed: 0,
    providerFailure: false,
    detail: null,
    providerDiagnostic: null,
  };
}

function normalizeOwnerSlice<T extends { status: unknown }>(
  value: unknown,
  fallback: T,
): T {
  if (value == null || typeof value !== "object") {
    return fallback;
  }
  const slice = value as T;
  if (!isLanguageActivationDomainStatus(slice.status)) {
    return fallback;
  }
  return { ...fallback, ...slice };
}

function normalizeTerminologyDomain(value: unknown): LanguageActivationTerminologyDomainProgress {
  const base = normalizeOwnerSlice(value, defaultTerminologyDomain());
  const raw =
    value != null && typeof value === "object"
      ? (value as { providerDiagnostic?: unknown }).providerDiagnostic
      : undefined;
  return {
    ...base,
    providerDiagnostic: sanitizeTerminologyProviderDiagnostic(raw),
  };
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
  const cv = domains.controlledVocabulary;
  return {
    ...domains,
    brand: normalizeOwnerSlice(domains.brand, defaultBrandDomain()),
    terminology: normalizeTerminologyDomain(domains.terminology),
    webUi: normalizeOwnerSlice(domains.webUi, defaultWebUiDomain()),
    controlledVocabulary: {
      ...cv,
      missingConceptIds: Array.isArray(cv.missingConceptIds)
        ? cv.missingConceptIds.filter((id): id is string => typeof id === "string")
        : [],
    },
  };
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
