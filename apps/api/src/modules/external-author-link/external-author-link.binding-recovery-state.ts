import { isIntegrityMediaBindingRecoveryEnabled } from "./external-author-link.config.js";
import {
  INTEGRITY_MEDIA_BINDING_RECOVERY_STATE_FAMILY_PATTERN,
  INTEGRITY_MEDIA_BINDING_RECOVERY_STATE_FUTURE_SKEW_SECONDS,
  INTEGRITY_MEDIA_BINDING_RECOVERY_STATE_MAX_LIFETIME_SECONDS,
  INTEGRITY_MEDIA_BINDING_RECOVERY_STATE_PURPOSE,
  INTEGRITY_MEDIA_BINDING_RECOVERY_STATE_V1_PATTERN,
} from "./external-author-link.constants.js";
import {
  integrityMediaEnvironmentTargetAccepted,
  type IntegrityMediaDeploymentTarget,
} from "./external-author-link.environment-target.js";
import {
  integrityMediaLinkSignaturesEqual,
  signIntegrityMediaLinkRedeem,
} from "./external-author-link.hmac.js";

export interface IntegrityMediaBindingRecoveryStateFields {
  huTarget: IntegrityMediaDeploymentTarget;
  issuedAt: number;
  expiresAt: number;
  externalAuthorId: string;
  nonce: string;
  recoveryId: string;
}

export type IntegrityMediaConfirmationStateClass =
  | { kind: "not_recovery" }
  | { kind: "recovery"; fields: IntegrityMediaBindingRecoveryStateFields }
  | { kind: "recovery_rejected"; status: number; code: string; message: string };

const TARGET_CODES: Record<IntegrityMediaDeploymentTarget, "p" | "s"> = {
  production: "p",
  staging: "s",
};

/** Eight lines joined by `\n`: purpose, version, target, issuedAt, expiresAt, author, nonce, recoveryId. */
export function buildIntegrityMediaBindingRecoveryStatePayload(
  fields: IntegrityMediaBindingRecoveryStateFields,
): string {
  return [
    INTEGRITY_MEDIA_BINDING_RECOVERY_STATE_PURPOSE,
    "1",
    fields.huTarget,
    String(fields.issuedAt),
    String(fields.expiresAt),
    fields.externalAuthorId,
    fields.nonce,
    fields.recoveryId,
  ].join("\n");
}

/** Version 1 encoding. Integrity Media issues states; Humanity Union uses this for tests. */
export function encodeIntegrityMediaBindingRecoveryState(
  fields: IntegrityMediaBindingRecoveryStateFields,
  secret: string,
): string {
  const signature = signIntegrityMediaLinkRedeem(
    secret,
    buildIntegrityMediaBindingRecoveryStatePayload(fields),
  );
  return [
    "hur1",
    TARGET_CODES[fields.huTarget],
    String(fields.issuedAt).padStart(10, "0"),
    String(fields.expiresAt).padStart(10, "0"),
    fields.externalAuthorId.replaceAll("-", ""),
    fields.nonce,
    fields.recoveryId,
    signature,
  ].join("");
}

export function isIntegrityMediaBindingRecoveryStateFamily(state: string): boolean {
  return INTEGRITY_MEDIA_BINDING_RECOVERY_STATE_FAMILY_PATTERN.test(state);
}

/**
 * Classify a confirmation `state`. A state outside the recovery family is
 * left to the ordinary and account-creation flows unchanged. A recovery
 * family state is either verified or rejected; it never falls back.
 */
export function classifyIntegrityMediaConfirmationState(input: {
  state: string;
  secret: string | null;
  now: Date;
  env?: NodeJS.ProcessEnv;
}): IntegrityMediaConfirmationStateClass {
  if (!isIntegrityMediaBindingRecoveryStateFamily(input.state)) {
    return { kind: "not_recovery" };
  }

  const env = input.env ?? process.env;
  if (!isIntegrityMediaBindingRecoveryEnabled(env)) {
    return rejected(503, "binding_recovery_disabled", "Integrity Media binding recovery is disabled.");
  }

  const match = INTEGRITY_MEDIA_BINDING_RECOVERY_STATE_V1_PATTERN.exec(input.state);
  if (!match) {
    return invalidState();
  }

  if (!input.secret) {
    return rejected(
      503,
      "binding_recovery_not_configured",
      "Integrity Media binding recovery is not configured.",
    );
  }

  const [, targetCode, issuedAt, expiresAt, authorHex, nonce, recoveryId, signature] = match;
  const fields: IntegrityMediaBindingRecoveryStateFields = {
    huTarget: targetCode === "p" ? "production" : "staging",
    issuedAt: Number(issuedAt),
    expiresAt: Number(expiresAt),
    externalAuthorId: dashedUuid(authorHex!),
    nonce: nonce!,
    recoveryId: recoveryId!,
  };
  const expected = signIntegrityMediaLinkRedeem(
    input.secret,
    buildIntegrityMediaBindingRecoveryStatePayload(fields),
  );

  if (!integrityMediaLinkSignaturesEqual(expected, signature!)) {
    return invalidState();
  }

  if (!integrityMediaEnvironmentTargetAccepted(fields.huTarget, env)) {
    return rejected(409, "environment_rejected", "The recovery target does not match this environment.");
  }

  const nowSeconds = Math.floor(input.now.getTime() / 1000);
  const lifetime = fields.expiresAt - fields.issuedAt;
  if (
    lifetime <= 0 ||
    lifetime > INTEGRITY_MEDIA_BINDING_RECOVERY_STATE_MAX_LIFETIME_SECONDS ||
    fields.issuedAt > nowSeconds + INTEGRITY_MEDIA_BINDING_RECOVERY_STATE_FUTURE_SKEW_SECONDS ||
    nowSeconds >= fields.expiresAt
  ) {
    return rejected(410, "recovery_state_expired", "This recovery confirmation link has expired.");
  }

  return { kind: "recovery", fields };
}

function dashedUuid(hex: string): string {
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function invalidState(): IntegrityMediaConfirmationStateClass {
  return rejected(400, "invalid_recovery_state", "This recovery confirmation link is not valid.");
}

function rejected(
  status: number,
  code: string,
  message: string,
): IntegrityMediaConfirmationStateClass {
  return { kind: "recovery_rejected", status, code, message };
}
