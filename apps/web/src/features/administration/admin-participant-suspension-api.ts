import type {
  AdminParticipantRestoreResult,
  AdminParticipantSuspendResult,
  AdminParticipantSuspensionSummary,
  ParticipantSuspensionReasonCode,
  ParticipantSuspensionReviewPublic,
  ParticipantSuspensionReviewSubmitResult,
} from "@hu/types";
import { PARTICIPANT_SUSPENSION_REASON_CODES } from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export const PARTICIPANT_SUSPENSION_REASON_OPTIONS: readonly {
  value: ParticipantSuspensionReasonCode;
  label: string;
}[] = [
  {
    value: "community_standards_violation",
    label: "Community standards violation",
  },
  {
    value: "spam_or_abusive_activity",
    label: "Spam or abusive activity",
  },
  {
    value: "security_or_account_integrity",
    label: "Security or account integrity concern",
  },
] as const;

export function isParticipantSuspensionReasonCode(
  value: string,
): value is ParticipantSuspensionReasonCode {
  return (PARTICIPANT_SUSPENSION_REASON_CODES as readonly string[]).includes(value);
}

export function formatParticipantSuspensionReasonLabel(
  reasonCode: ParticipantSuspensionReasonCode,
): string {
  const found = PARTICIPANT_SUSPENSION_REASON_OPTIONS.find((option) => option.value === reasonCode);
  return found?.label ?? reasonCode;
}

export async function suspendAdminParticipant(
  participantId: string,
  reasonCode: ParticipantSuspensionReasonCode,
): Promise<AdminParticipantSuspendResult> {
  return apiRequest<AdminParticipantSuspendResult>(
    `/api/v1/admin/participants/${encodeURIComponent(participantId)}/suspend`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reasonCode }),
    },
  );
}

export async function restoreAdminParticipant(
  participantId: string,
): Promise<AdminParticipantRestoreResult> {
  return apiRequest<AdminParticipantRestoreResult>(
    `/api/v1/admin/participants/${encodeURIComponent(participantId)}/restore`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
  );
}

export async function fetchAdminParticipantSuspension(
  participantId: string,
): Promise<AdminParticipantSuspensionSummary> {
  return apiRequest<AdminParticipantSuspensionSummary>(
    `/api/v1/admin/participants/${encodeURIComponent(participantId)}/suspension`,
  );
}

export async function fetchPublicSuspensionReview(
  token: string,
): Promise<ParticipantSuspensionReviewPublic> {
  const params = new URLSearchParams({ token });
  return apiRequest<ParticipantSuspensionReviewPublic>(
    `/api/v1/public/suspension-review?${params.toString()}`,
  );
}

export async function submitPublicSuspensionReview(input: {
  token: string;
  explanation: string;
}): Promise<ParticipantSuspensionReviewSubmitResult> {
  return apiRequest<ParticipantSuspensionReviewSubmitResult>(
    `/api/v1/public/suspension-review`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: input.token,
        explanation: input.explanation,
      }),
    },
  );
}
