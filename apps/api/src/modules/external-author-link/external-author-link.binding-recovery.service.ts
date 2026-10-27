import {
  BINDING_RECOVERY_REJECTIONS,
  IntegrityMediaBindingRecoveryIncompleteError,
  IntegrityMediaBindingRecoveryInterruptedError,
  sameRecoveryRequest,
  type BindingRecoveryApplyResult,
  type IntegrityMediaBindingRecoveryRequest,
} from "./external-author-link.binding-recovery.js";
import { isIntegrityMediaBindingRecoveryEnabled } from "./external-author-link.config.js";
import {
  INTEGRITY_MEDIA_AUTHOR_ID_PATTERN,
  INTEGRITY_MEDIA_RECOVERY_ID_PATTERN,
  INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS,
  INTEGRITY_MEDIA_RESULT_CODE_PATTERN,
  INTEGRITY_MEDIA_SOURCE,
} from "./external-author-link.constants.js";
import {
  integrityMediaEnvironmentTargetAccepted,
  isIntegrityMediaDeploymentTarget,
} from "./external-author-link.environment-target.js";
import {
  buildIntegrityMediaBindingRecoveryPayload,
  hasIntegrityMediaBindingRecoverySignature,
  integrityMediaLinkSignaturesEqual,
  noteIntegrityMediaBindingRecoverySignature,
  signIntegrityMediaLinkRedeem,
} from "./external-author-link.hmac.js";
import { findProvisionAttemptAuthorId } from "./external-author-link.provision.service.js";
import { getExternalAuthorLinkStore } from "./external-author-link.store.js";

export interface IntegrityMediaBindingRecoverySuccess {
  ok: true;
  source: typeof INTEGRITY_MEDIA_SOURCE;
  externalAuthorId: string;
  huTarget: string;
  memberId: string;
  linkRevision: number;
  linkInstanceId: string;
  replacedMemberId: string;
  replacedLinkRevision: number;
  replacedLinkInstanceId: string;
}

export interface IntegrityMediaBindingRecoveryFailure {
  ok: false;
  status: number;
  code: string;
  message: string;
}

export function bindingRecoveryDisabledFailure(): IntegrityMediaBindingRecoveryFailure {
  return failure(503, "binding_recovery_disabled", "Integrity Media binding recovery is disabled.");
}

/**
 * IM → HU rebinding of one confirmed author link. Disabled unless
 * INTEGRITY_MEDIA_BINDING_RECOVERY_ENABLED is exactly `true`. The replacement
 * member comes only from the confirmation result, never from the caller.
 */
export async function redeemIntegrityMediaBindingRecovery(
  input: IntegrityMediaBindingRecoveryRequest & {
    timestamp: string;
    signature: string;
    secret: string | null;
    now?: Date;
  },
): Promise<IntegrityMediaBindingRecoverySuccess | IntegrityMediaBindingRecoveryFailure> {
  if (!isIntegrityMediaBindingRecoveryEnabled()) {
    return bindingRecoveryDisabledFailure();
  }

  if (!hasValidShape(input)) {
    return failure(400, "invalid_request", "The recovery request is not valid.");
  }

  if (!input.secret) {
    return failure(
      503,
      "binding_recovery_not_configured",
      "Integrity Media binding recovery is not configured.",
    );
  }

  const now = input.now ?? new Date();
  const request: IntegrityMediaBindingRecoveryRequest = {
    resultCode: input.resultCode,
    externalAuthorId: input.externalAuthorId,
    huTarget: input.huTarget,
    expectedHuMemberId: input.expectedHuMemberId,
    expectedHuLinkRevision: input.expectedHuLinkRevision,
    expectedHuLinkInstanceId: input.expectedHuLinkInstanceId,
    recoveryId: input.recoveryId,
  };
  const expected = signIntegrityMediaLinkRedeem(
    input.secret,
    buildIntegrityMediaBindingRecoveryPayload({ timestamp: input.timestamp, ...request }),
  );

  if (!integrityMediaLinkSignaturesEqual(expected, input.signature)) {
    return failure(401, "invalid_signature", "The recovery signature is not valid.");
  }

  const timestampSeconds = Number(input.timestamp);
  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS) {
    return failure(401, "stale_timestamp", "The recovery timestamp is outside the allowed window.");
  }

  if (!integrityMediaEnvironmentTargetAccepted(request.huTarget)) {
    return failure(409, "environment_rejected", "The recovery target does not match this environment.");
  }

  const store = getExternalAuthorLinkStore();
  const receipt = await store.findBindingRecoveryReceipt(request.recoveryId);

  if (receipt && !sameRecoveryRequest(receipt, request)) {
    return toResponse(request, { kind: "conflict" });
  }

  if (!receipt && hasIntegrityMediaBindingRecoverySignature(input.signature, now.getTime())) {
    return failure(401, "replayed", "This recovery request was already used.");
  }

  noteIntegrityMediaBindingRecoverySignature(input.signature, now.getTime());

  const result = await store.findResult(request.resultCode);
  const provisionAuthorId = result ? await findProvisionAttemptAuthorId(result.attemptState) : null;

  try {
    const applied = await store.applyBindingRecovery({ request, provisionAuthorId, now });
    return toResponse(request, applied);
  } catch (error) {
    if (
      error instanceof IntegrityMediaBindingRecoveryInterruptedError ||
      error instanceof IntegrityMediaBindingRecoveryIncompleteError
    ) {
      return failure(
        503,
        "recovery_incomplete",
        "Integrity Media binding recovery could not be finished.",
      );
    }

    throw error;
  }
}

function hasValidShape(input: IntegrityMediaBindingRecoveryRequest & { timestamp: string }): boolean {
  return (
    INTEGRITY_MEDIA_RESULT_CODE_PATTERN.test(input.resultCode) &&
    INTEGRITY_MEDIA_AUTHOR_ID_PATTERN.test(input.externalAuthorId) &&
    INTEGRITY_MEDIA_AUTHOR_ID_PATTERN.test(input.expectedHuMemberId) &&
    INTEGRITY_MEDIA_AUTHOR_ID_PATTERN.test(input.expectedHuLinkInstanceId) &&
    INTEGRITY_MEDIA_RECOVERY_ID_PATTERN.test(input.recoveryId) &&
    isIntegrityMediaDeploymentTarget(input.huTarget) &&
    Number.isInteger(input.expectedHuLinkRevision) &&
    input.expectedHuLinkRevision >= 1 &&
    /^\d{10}$/.test(input.timestamp)
  );
}

function toResponse(
  request: IntegrityMediaBindingRecoveryRequest,
  applied: BindingRecoveryApplyResult,
): IntegrityMediaBindingRecoverySuccess | IntegrityMediaBindingRecoveryFailure {
  if (applied.kind === "conflict") {
    return failure(409, "recovery_conflict", "This recovery id is already bound to another request.");
  }

  if (applied.kind === "rejected") {
    const rejection = BINDING_RECOVERY_REJECTIONS[applied.code];
    return failure(rejection.status, applied.code, rejection.message);
  }

  return {
    ok: true,
    source: INTEGRITY_MEDIA_SOURCE,
    externalAuthorId: request.externalAuthorId,
    huTarget: request.huTarget,
    ...applied.outcome,
  };
}

function failure(status: number, code: string, message: string): IntegrityMediaBindingRecoveryFailure {
  return { ok: false, status, code, message };
}
