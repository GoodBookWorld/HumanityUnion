import { randomUUID } from "node:crypto";

import { resolveMongoConfig } from "../../infrastructure/mongodb/mongo-config.js";
import { bootstrapAuthPersistence } from "../../infrastructure/mongodb/bootstrap-auth-persistence.js";
import { confirmMemberRegistration } from "../member/application/confirm-member-registration.service.js";
import {
  findMemberById,
  findMemberByIdentityId,
} from "../member/infrastructure/member.repository.js";
import { createMemberProfileForUser } from "../member-profile/member-profile.service.js";
import {
  findAuthUserByEmail,
  insertAuthUser,
} from "./auth-user.repository.js";
import type { AuthUserRecord } from "./auth-user.types.js";

/** Exact staging database name allowed for real provisioning. */
export const STAGING_ADMIN_PROVISION_DATABASE = "humanity_union_staging";

/** Explicit opt-in flag required before any write. */
export const STAGING_ADMIN_PROVISION_FLAG = "ALLOW_STAGING_ADMIN_PROVISION";

const FORBIDDEN_DATABASE_NAMES = new Set([
  "humanity_union_dev",
  "humanity_union",
  "humanity_union_production",
  "production",
  "development",
  "admin",
  "local",
  "config",
]);

const TEST_DATABASE_NAME_PATTERN = /^hu_test_[a-zA-Z0-9_]+$/;

export class StagingAdminProvisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StagingAdminProvisionError";
  }
}

export interface StagingAdminCredentials {
  email: string;
  password: string;
  displayName: string;
}

export interface StagingAdminProvisionResult {
  outcome: "created" | "already_complete";
  email: string;
  userId: string;
  memberId: string;
  role: AuthUserRecord["role"];
  database: string;
  message: string;
}

export interface StagingAdminProvisionGuardInput {
  NODE_ENV?: string;
  PLATFORM_MODE?: string;
  ALLOW_STAGING_ADMIN_PROVISION?: string;
  AUTH_BOOTSTRAP_FALLBACK?: string;
  NODE_TEST_ENV?: string;
  database?: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Returns true only for the staging DB, or isolated `hu_test_*` DBs when
 * `NODE_TEST_ENV=true` (focused automated tests). Never allows
 * `humanity_union_dev`, production, or unknown names.
 */
export function isAllowedStagingAdminProvisionDatabase(
  database: string,
  options: { nodeTestEnv?: boolean } = {},
): boolean {
  const name = database.trim();

  if (!name || FORBIDDEN_DATABASE_NAMES.has(name)) {
    return false;
  }

  if (name === STAGING_ADMIN_PROVISION_DATABASE) {
    return true;
  }

  if (options.nodeTestEnv === true && TEST_DATABASE_NAME_PATTERN.test(name)) {
    return true;
  }

  return false;
}

/**
 * Pure guard evaluation — used by the CLI and by focused unit tests.
 * Does not connect to Mongo or mutate state.
 */
export function assertStagingAdminProvisionGuards(
  env: StagingAdminProvisionGuardInput = process.env,
): void {
  if (env.NODE_ENV !== "production") {
    throw new StagingAdminProvisionError(
      "Refusing staging admin provision: NODE_ENV must be production.",
    );
  }

  if (env.PLATFORM_MODE?.trim() !== "staging") {
    throw new StagingAdminProvisionError(
      "Refusing staging admin provision: PLATFORM_MODE must be staging.",
    );
  }

  if (env.ALLOW_STAGING_ADMIN_PROVISION !== "true") {
    throw new StagingAdminProvisionError(
      `Refusing staging admin provision: set ${STAGING_ADMIN_PROVISION_FLAG}=true to confirm.`,
    );
  }

  if (env.AUTH_BOOTSTRAP_FALLBACK === "true" || env.AUTH_BOOTSTRAP_FALLBACK === "1") {
    throw new StagingAdminProvisionError(
      "Refusing staging admin provision: AUTH_BOOTSTRAP_FALLBACK must remain false (do not use bootstrap fallback).",
    );
  }

  const database = (env.database ?? resolveMongoConfig().database).trim();

  if (!isAllowedStagingAdminProvisionDatabase(database, { nodeTestEnv: env.NODE_TEST_ENV === "true" })) {
    throw new StagingAdminProvisionError(
      `Refusing staging admin provision: database "${database}" is not allowed (expected ${STAGING_ADMIN_PROVISION_DATABASE}).`,
    );
  }
}

export function readStagingAdminCredentials(
  env: NodeJS.ProcessEnv = process.env,
): StagingAdminCredentials {
  const email = env.STAGING_ADMIN_EMAIL?.trim() ?? "";
  const password = env.STAGING_ADMIN_PASSWORD ?? "";
  const displayName = env.STAGING_ADMIN_DISPLAY_NAME?.trim() ?? "";

  if (!email || !email.includes("@")) {
    throw new StagingAdminProvisionError(
      "STAGING_ADMIN_EMAIL must be set to a valid email address.",
    );
  }

  if (password.length < 8) {
    throw new StagingAdminProvisionError(
      "STAGING_ADMIN_PASSWORD must be set and at least 8 characters.",
    );
  }

  if (!displayName) {
    throw new StagingAdminProvisionError("STAGING_ADMIN_DISPLAY_NAME must be set.");
  }

  return {
    email: normalizeEmail(email),
    password,
    displayName,
  };
}

function assertLinkedAdminConsistent(authUser: AuthUserRecord): void {
  if (authUser.role !== "admin") {
    throw new StagingAdminProvisionError(
      `Inconsistent staging admin state: auth user ${authUser.userId} exists but role is "${authUser.role}", not admin.`,
    );
  }
}

async function resolveExistingProvision(
  authUser: AuthUserRecord,
  database: string,
): Promise<StagingAdminProvisionResult> {
  assertLinkedAdminConsistent(authUser);

  const byMemberId = await findMemberById(authUser.memberId);
  const byIdentityId = await findMemberByIdentityId(authUser.userId);

  if (!byMemberId && !byIdentityId) {
    throw new StagingAdminProvisionError(
      `Inconsistent staging admin state: auth user ${authUser.userId} exists but linked Member/Participant is missing.`,
    );
  }

  if (!byMemberId || !byIdentityId) {
    throw new StagingAdminProvisionError(
      `Inconsistent staging admin state: Member/Participant linkage is incomplete for auth user ${authUser.userId}.`,
    );
  }

  if (byMemberId.memberId !== byIdentityId.memberId) {
    throw new StagingAdminProvisionError(
      `Inconsistent staging admin state: Member lookup by memberId and identityId disagree for auth user ${authUser.userId}.`,
    );
  }

  if (byMemberId.identityId !== authUser.userId) {
    throw new StagingAdminProvisionError(
      `Inconsistent staging admin state: Member ${byMemberId.memberId} identityId does not match auth user ${authUser.userId}.`,
    );
  }

  if (byIdentityId.memberId !== authUser.memberId) {
    throw new StagingAdminProvisionError(
      `Inconsistent staging admin state: Member identityId points to memberId ${byIdentityId.memberId}, auth expects ${authUser.memberId}.`,
    );
  }

  return {
    outcome: "already_complete",
    email: authUser.email,
    userId: authUser.userId,
    memberId: authUser.memberId,
    role: authUser.role,
    database,
    message: "Staging admin provisioning already complete; no changes made.",
  };
}

/**
 * Provisions a single staging administrator using existing auth + Member
 * registration primitives. Idempotent when the admin already exists and is
 * consistently linked. Does not reset passwords. Does not start HTTP.
 */
export async function provisionStagingAdmin(
  options: {
    env?: NodeJS.ProcessEnv;
    credentials?: StagingAdminCredentials;
    skipBootstrap?: boolean;
  } = {},
): Promise<StagingAdminProvisionResult> {
  const env = options.env ?? process.env;
  const database = resolveMongoConfig().database;

  assertStagingAdminProvisionGuards({
    NODE_ENV: env.NODE_ENV,
    PLATFORM_MODE: env.PLATFORM_MODE,
    ALLOW_STAGING_ADMIN_PROVISION: env.ALLOW_STAGING_ADMIN_PROVISION,
    AUTH_BOOTSTRAP_FALLBACK: env.AUTH_BOOTSTRAP_FALLBACK,
    NODE_TEST_ENV: env.NODE_TEST_ENV,
    database,
  });

  const credentials = options.credentials ?? readStagingAdminCredentials(env);

  if (!options.skipBootstrap) {
    await bootstrapAuthPersistence();
  }

  const existingAuth = await findAuthUserByEmail(credentials.email);

  if (existingAuth) {
    return resolveExistingProvision(existingAuth, database);
  }

  // Auth missing — refuse if a Member already claims this identity path
  // would be ambiguous; there is no email on Member, so we only create fresh.

  const memberId = randomUUID();
  const authUser = await insertAuthUser(
    {
      email: credentials.email,
      password: credentials.password,
      displayName: credentials.displayName,
      role: "admin",
    },
    memberId,
  );

  await createMemberProfileForUser({
    userId: authUser.userId,
    displayName: credentials.displayName,
  });

  const registration = await confirmMemberRegistration(authUser, {
    correlationId: `staging-admin-provision:${authUser.userId}`,
  });

  if (registration.member.memberId !== authUser.memberId) {
    throw new StagingAdminProvisionError(
      "Inconsistent staging admin state: Member memberId does not match auth user memberId after provision.",
    );
  }

  if (registration.member.identityId !== authUser.userId) {
    throw new StagingAdminProvisionError(
      "Inconsistent staging admin state: Member identityId does not match auth userId after provision.",
    );
  }

  return {
    outcome: "created",
    email: authUser.email,
    userId: authUser.userId,
    memberId: authUser.memberId,
    role: authUser.role,
    database,
    message: "Staging admin provisioned successfully.",
  };
}

/** Safe CLI summary — never includes password, JWT, URI, or secrets. */
export function formatStagingAdminProvisionSummary(result: StagingAdminProvisionResult): string {
  return [
    `email: ${result.email}`,
    `userId: ${result.userId}`,
    `memberId: ${result.memberId}`,
    `role: ${result.role}`,
    `database: ${result.database}`,
    `outcome: ${result.outcome}`,
    result.message,
  ].join("\n");
}
