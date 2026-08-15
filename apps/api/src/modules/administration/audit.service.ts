import { randomUUID } from "node:crypto";

import type {
  AdministrationAuditAppendInput,
  AdministrationAuditRecord,
} from "@hu/types";

import { AdministrationValidationError } from "./administration.errors.js";
import { emitAdministrationAuditRecorded } from "./administration.events.js";
import {
  appendAdministrationAuditRecord,
  findAdministrationAuditById,
  listAdministrationAuditByTarget,
  rejectAuditMutation,
} from "./persistence/administration-audit.repository.js";

const SENSITIVE_PATTERNS = [
  /password/i,
  /smtp/i,
  /api[_-]?key/i,
  /bearer\s+/i,
  /mongodb(\+srv)?:\/\//i,
  /authorization:\s*/i,
];

function sanitizeSummary(value: string | undefined, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.length > 2000) {
    throw new AdministrationValidationError(`${field} must be at most 2000 characters.`);
  }
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(trimmed)) {
      throw new AdministrationValidationError(
        `${field} must not contain secrets or credential material.`,
      );
    }
  }
  return trimmed;
}

/**
 * Canonical AuditService — append-only.
 * Domains must call record(); they must never mutate audit storage directly.
 */
export async function record(
  input: AdministrationAuditAppendInput,
): Promise<AdministrationAuditRecord> {
  if (!input.actorParticipantId?.trim()) {
    throw new AdministrationValidationError("actorParticipantId is required.");
  }
  if (!input.targetType?.trim() || !input.targetId?.trim()) {
    throw new AdministrationValidationError("targetType and targetId are required.");
  }

  const recordDoc: AdministrationAuditRecord = {
    auditId: `admin-audit-${randomUUID()}`,
    actorParticipantId: input.actorParticipantId.trim(),
    action: input.action,
    targetType: input.targetType.trim(),
    targetId: input.targetId.trim(),
    scope: input.scope ?? { scopeType: "global" },
    reason: sanitizeSummary(input.reason, "reason"),
    beforeSummary: sanitizeSummary(input.beforeSummary, "beforeSummary"),
    afterSummary: sanitizeSummary(input.afterSummary, "afterSummary"),
    createdAt: new Date().toISOString(),
    correlationId: input.correlationId?.trim() || undefined,
  };

  const saved = await appendAdministrationAuditRecord(recordDoc);
  await emitAdministrationAuditRecorded(saved).catch(() => {
    /* never block privileged domain workflows on outbox */
  });
  return saved;
}

/** Safe fire-and-forget wrapper for domain integration without behavior change. */
export function recordAdministrationAuditBestEffort(
  input: AdministrationAuditAppendInput,
): void {
  void record(input).catch(() => {
    /* never block privileged domain workflows */
  });
}

export async function getAdministrationAuditById(
  auditId: string,
): Promise<AdministrationAuditRecord | null> {
  return findAdministrationAuditById(auditId);
}

export async function listAdministrationAuditsForTarget(input: {
  targetType: string;
  targetId: string;
  limit?: number;
}): Promise<AdministrationAuditRecord[]> {
  return listAdministrationAuditByTarget(input);
}

/** Public no-ops that document immutability for callers/tests. */
export function updateAdministrationAudit(): never {
  return rejectAuditMutation();
}

export function deleteAdministrationAudit(): never {
  return rejectAuditMutation();
}

export const AuditService = {
  record,
  recordBestEffort: recordAdministrationAuditBestEffort,
  getById: getAdministrationAuditById,
  listForTarget: listAdministrationAuditsForTarget,
  update: updateAdministrationAudit,
  delete: deleteAdministrationAudit,
} as const;
