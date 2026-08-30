/**
 * Controlled production auth activation — sends canonical password-reset emails
 * for migrated/bootstrap shells. Never sets passwords. Never alters roles.
 */

import { requestPasswordResetForUserId } from "../auth/auth-email.service.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import {
  resolveProductionAuthActivationAllowlist,
  type ActivationAllowlistEntry,
} from "./allowlist.js";
import {
  PRODUCTION_AUTH_ACTIVATION_CONFIRM_FLAG,
  PRODUCTION_AUTH_ACTIVATION_CONFIRM_VALUE,
  PRODUCTION_AUTH_ACTIVATION_TARGET_DATABASE,
  isTestIsolationDatabase,
} from "./constants.js";
import { ProductionAuthActivationError } from "./errors.js";
import { assertNoSecretLeak, stripForbiddenReportFields } from "./redact.js";

export type ActivationAccountAction =
  | "would_send_password_reset"
  | "sent_password_reset"
  | "skipped_already_verified"
  | "skipped_disabled"
  | "skipped_missing"
  | "skipped_role_mismatch"
  | "blocked";

export interface ActivationAccountPlanRow {
  userId: string;
  label: string;
  source: ActivationAllowlistEntry["source"];
  authRole: string | null;
  emailVerificationStatus: string | null;
  status: string | null;
  action: ActivationAccountAction;
  note?: string;
}

export interface ProductionAuthActivationReport {
  tool: "activate-production-auth";
  mode: "dry-run" | "execute";
  destinationDatabase: string;
  overallStatus: "DRY_RUN_OK" | "COMPLETED" | "BLOCKED" | "FAILED";
  planned: ActivationAccountPlanRow[];
  counts: {
    allowlisted: number;
    wouldSend: number;
    sent: number;
    skippedAlreadyVerified: number;
    skippedDisabled: number;
    skippedMissing: number;
    skippedRoleMismatch: number;
    blocked: number;
  };
  sideEffects: {
    passwordMaterialWritten: 0;
    rolesChanged: 0;
    sessionsCreated: 0;
    emailsQueued: number;
  };
  blockers: string[];
  notes: string[];
}

export interface RunProductionAuthActivationInput {
  destinationDatabase: string;
  execute: boolean;
  confirm?: string;
  allowTestIsolation?: boolean;
  allowlist?: ActivationAllowlistEntry[];
  /** Test hook — replace password-reset sender. */
  sendPasswordReset?: (userId: string) => Promise<{ sent: true } | { sent: false; reason: "not_found" }>;
  findUser?: typeof findAuthUserById;
}

function resolveMode(input: {
  execute: boolean;
  confirm?: string;
}): "dry-run" | "execute" {
  if (input.execute && input.confirm === PRODUCTION_AUTH_ACTIVATION_CONFIRM_VALUE) {
    return "execute";
  }
  return "dry-run";
}

function assertDestinationDatabase(
  database: string,
  allowTestIsolation?: boolean,
): void {
  const name = database.trim();
  if (name === PRODUCTION_AUTH_ACTIVATION_TARGET_DATABASE) return;
  if (allowTestIsolation && isTestIsolationDatabase(name)) return;
  throw new ProductionAuthActivationError(
    `Destination database must be ${PRODUCTION_AUTH_ACTIVATION_TARGET_DATABASE}.`,
    "WRONG_DESTINATION_DATABASE",
  );
}

export async function runProductionAuthActivation(
  input: RunProductionAuthActivationInput,
): Promise<ProductionAuthActivationReport> {
  const blockers: string[] = [];
  const notes: string[] = [
    "Activation only queues canonical password-reset emails.",
    "Participants must set a NEW production password, then complete email confirmation on login.",
    "Does not copy staging passwords or session material and does not set a known password.",
  ];

  try {
    assertDestinationDatabase(input.destinationDatabase, input.allowTestIsolation);
  } catch (error) {
    blockers.push(error instanceof Error ? error.message : String(error));
  }

  const mode = resolveMode({ execute: input.execute, confirm: input.confirm });
  if (input.execute && mode === "dry-run") {
    blockers.push(
      `Refusing write: set ${PRODUCTION_AUTH_ACTIVATION_CONFIRM_FLAG}=${PRODUCTION_AUTH_ACTIVATION_CONFIRM_VALUE} with --execute.`,
    );
  }

  const allowlist = input.allowlist ?? resolveProductionAuthActivationAllowlist();
  const findUser = input.findUser ?? findAuthUserById;
  const sendReset = input.sendPasswordReset ?? requestPasswordResetForUserId;

  const planned: ActivationAccountPlanRow[] = [];
  let emailsQueued = 0;

  if (blockers.length === 0) {
    for (const entry of allowlist) {
      const user = await findUser(entry.userId);
      if (!user) {
        planned.push({
          userId: entry.userId,
          label: entry.label,
          source: entry.source,
          authRole: null,
          emailVerificationStatus: null,
          status: null,
          action: "skipped_missing",
          note: "auth_users row not found",
        });
        continue;
      }

      if (user.role !== entry.expectedAuthRole) {
        planned.push({
          userId: entry.userId,
          label: entry.label,
          source: entry.source,
          authRole: user.role,
          emailVerificationStatus: user.emailVerificationStatus,
          status: user.status,
          action: "skipped_role_mismatch",
          note: `expected auth role ${entry.expectedAuthRole}`,
        });
        continue;
      }

      if (user.status === "disabled") {
        planned.push({
          userId: entry.userId,
          label: entry.label,
          source: entry.source,
          authRole: user.role,
          emailVerificationStatus: user.emailVerificationStatus,
          status: user.status,
          action: "skipped_disabled",
        });
        continue;
      }

      if (user.emailVerificationStatus === "verified") {
        planned.push({
          userId: entry.userId,
          label: entry.label,
          source: entry.source,
          authRole: user.role,
          emailVerificationStatus: user.emailVerificationStatus,
          status: user.status,
          action: "skipped_already_verified",
          note: "already activated; use public password-reset if password change needed",
        });
        continue;
      }

      if (mode === "dry-run") {
        planned.push({
          userId: entry.userId,
          label: entry.label,
          source: entry.source,
          authRole: user.role,
          emailVerificationStatus: user.emailVerificationStatus,
          status: user.status,
          action: "would_send_password_reset",
        });
        continue;
      }

      const result = await sendReset(entry.userId);
      if (!result.sent) {
        planned.push({
          userId: entry.userId,
          label: entry.label,
          source: entry.source,
          authRole: user.role,
          emailVerificationStatus: user.emailVerificationStatus,
          status: user.status,
          action: "blocked",
          note: "password-reset send failed",
        });
        blockers.push(`Failed to queue password reset for ${entry.label}`);
        continue;
      }

      emailsQueued += 1;
      planned.push({
        userId: entry.userId,
        label: entry.label,
        source: entry.source,
        authRole: user.role,
        emailVerificationStatus: user.emailVerificationStatus,
        status: user.status,
        action: "sent_password_reset",
      });
    }
  }

  const counts = {
    allowlisted: allowlist.length,
    wouldSend: planned.filter((row) => row.action === "would_send_password_reset").length,
    sent: planned.filter((row) => row.action === "sent_password_reset").length,
    skippedAlreadyVerified: planned.filter((row) => row.action === "skipped_already_verified")
      .length,
    skippedDisabled: planned.filter((row) => row.action === "skipped_disabled").length,
    skippedMissing: planned.filter((row) => row.action === "skipped_missing").length,
    skippedRoleMismatch: planned.filter((row) => row.action === "skipped_role_mismatch").length,
    blocked: planned.filter((row) => row.action === "blocked").length,
  };

  let overallStatus: ProductionAuthActivationReport["overallStatus"];
  if (blockers.length > 0) {
    overallStatus = mode === "dry-run" ? "BLOCKED" : "FAILED";
  } else if (mode === "dry-run") {
    overallStatus = "DRY_RUN_OK";
  } else {
    overallStatus = "COMPLETED";
  }

  const report: ProductionAuthActivationReport = {
    tool: "activate-production-auth",
    mode,
    destinationDatabase: input.destinationDatabase,
    overallStatus,
    planned,
    counts,
    sideEffects: {
      passwordMaterialWritten: 0,
      rolesChanged: 0,
      sessionsCreated: 0,
      emailsQueued,
    },
    blockers: [...new Set(blockers)],
    notes,
  };

  const safe = stripForbiddenReportFields(report);
  assertNoSecretLeak(JSON.stringify(safe));
  return safe;
}

export function isProductionAuthActivationExecuteRequested(
  argv: readonly string[] = process.argv,
): boolean {
  return argv.includes("--execute");
}

export function resolveProductionAuthActivationMode(input: {
  execute: boolean;
  confirm?: string;
}): "dry-run" | "execute" {
  return resolveMode(input);
}
