import type { LegalDocumentType, LegalLocalizationRecord, LegalLocalizationStatus } from "@hu/types";
import { isLegalDocumentType, isLegalLocalizationStatus } from "@hu/types";

import { LegalLocalizationValidationError } from "./legal-localization.errors.js";

export interface LegalLocalizationMongoDocument {
  legalId: string;
  documentType: LegalDocumentType;
  locale: string;
  canonicalSourceVersion: string;
  localizedBody: string;
  status: LegalLocalizationStatus;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  updatedByParticipantId?: string | null;
}

export function toLegalLocalizationMongoDocument(
  record: LegalLocalizationRecord,
): LegalLocalizationMongoDocument {
  return {
    legalId: record.legalId,
    documentType: record.documentType,
    locale: record.locale,
    canonicalSourceVersion: record.canonicalSourceVersion,
    localizedBody: record.localizedBody,
    status: record.status,
    approvedAt: record.approvedAt ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    updatedByParticipantId: record.updatedByParticipantId ?? null,
  };
}

export function fromLegalLocalizationMongoDocument(
  doc: LegalLocalizationMongoDocument,
): LegalLocalizationRecord {
  if (!isLegalDocumentType(doc.documentType)) {
    throw new LegalLocalizationValidationError(
      `Invalid legal document type in persistence: ${String(doc.documentType)}`,
    );
  }
  if (!isLegalLocalizationStatus(doc.status)) {
    throw new LegalLocalizationValidationError(
      `Invalid legal localization status in persistence: ${String(doc.status)}`,
    );
  }
  return {
    legalId: doc.legalId,
    documentType: doc.documentType,
    locale: doc.locale,
    canonicalSourceVersion: doc.canonicalSourceVersion,
    localizedBody: doc.localizedBody,
    status: doc.status,
    approvedAt: doc.approvedAt ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    updatedByParticipantId: doc.updatedByParticipantId ?? null,
  };
}
