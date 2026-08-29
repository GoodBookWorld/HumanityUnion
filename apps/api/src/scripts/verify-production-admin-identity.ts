/**
 * Independent post-write verification for production Admin (Volody) bootstrap.
 *
 * Read-only. Never writes. Safe logging only (IDs, masked email, roles, counts).
 *
 * Usage (production operator shell with production Mongo env):
 *   pnpm --filter @hu/api verify:production-admin-identity
 */

import { loadApiEnvironment } from "../config/load-api-environment.js";
import { MONGO_COLLECTIONS } from "../infrastructure/mongodb/mongo-collections.js";
import {
  isMongoConfigured,
  resolveMongoConfig,
} from "../infrastructure/mongodb/mongo-config.js";
import {
  connectMongoClient,
  disconnectMongoClient,
  getMongoClient,
} from "../infrastructure/mongodb/mongo-connection.js";
import {
  APPROVED_PRODUCTION_ADMIN,
  PRODUCTION_ADMIN_BOOTSTRAP_DATABASE,
  PROTECTED_PRODUCTION_STEWARD_IDS,
  ProductionAdminBootstrapError,
  assertNoSecretLeak,
  maskEmail,
} from "../modules/production-admin-bootstrap/index.js";

loadApiEnvironment();

const SYSTEM_MEDIA_RECOVERY_OWNER = "system-media-recovery";

async function main(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new ProductionAdminBootstrapError(
      "MongoDB is not configured.",
      "MONGO_UNCONFIGURED",
    );
  }

  const config = resolveMongoConfig();
  if (config.database !== PRODUCTION_ADMIN_BOOTSTRAP_DATABASE) {
    throw new ProductionAdminBootstrapError(
      `Verification requires database ${PRODUCTION_ADMIN_BOOTSTRAP_DATABASE} (got "${config.database}").`,
      "WRONG_DATABASE",
    );
  }

  await connectMongoClient();
  try {
    const db = getMongoClient().db(config.database);
    const a = APPROVED_PRODUCTION_ADMIN;

    const [auth, member, profile, membership, sessions, verificationTokens, confirmationCodes] =
      await Promise.all([
        db.collection(MONGO_COLLECTIONS.authUsers).findOne({ userId: a.userId }),
        db.collection(MONGO_COLLECTIONS.members).findOne({ memberId: a.memberId }),
        db.collection(MONGO_COLLECTIONS.memberProfiles).findOne({ profileId: a.profileId }),
        db.collection(MONGO_COLLECTIONS.memberships).findOne({
          $or: [{ memberId: a.memberId }, { userId: a.userId }],
        }),
        db.collection(MONGO_COLLECTIONS.authSessions).countDocuments({ userId: a.userId }),
        db
          .collection(MONGO_COLLECTIONS.emailVerificationTokens)
          .countDocuments({ userId: a.userId }),
        db
          .collection(MONGO_COLLECTIONS.emailConfirmationCodes)
          .countDocuments({ userId: a.userId }),
      ]);

    const checks: Array<{ name: string; ok: boolean; detail: string }> = [];

    checks.push({
      name: "auth_users_present",
      ok: Boolean(auth),
      detail: auth ? `userId=${a.userId}` : "missing",
    });
    checks.push({
      name: "auth_users_role_admin",
      ok: auth?.role === "admin",
      detail: `role=${String(auth?.role ?? "n/a")}`,
    });
    checks.push({
      name: "auth_users_status_active",
      ok: auth?.status === "active",
      detail: `status=${String(auth?.status ?? "n/a")}`,
    });
    checks.push({
      name: "auth_users_email_verification_pending",
      ok: auth?.emailVerificationStatus === "pending",
      detail: `emailVerificationStatus=${String(auth?.emailVerificationStatus ?? "n/a")}`,
    });
    checks.push({
      name: "auth_users_exact_ids",
      ok:
        String(auth?.userId) === a.userId &&
        String(auth?.memberId) === a.memberId &&
        String(auth?.displayName) === a.displayName,
      detail: "userId/memberId/displayName",
    });
    checks.push({
      name: "auth_users_no_verified_or_login",
      ok: auth?.emailVerifiedAt == null && auth?.lastLoginAt == null && auth?.pendingEmail == null,
      detail: "emailVerifiedAt/lastLoginAt/pendingEmail absent",
    });

    checks.push({
      name: "members_present",
      ok: Boolean(member),
      detail: member ? `memberId=${a.memberId}` : "missing",
    });
    checks.push({
      name: "members_roles_member_only",
      ok:
        Array.isArray(member?.roles) &&
        member.roles.length === 1 &&
        member.roles[0] === "member",
      detail: `roles=${JSON.stringify(member?.roles ?? null)}`,
    });
    checks.push({
      name: "members_uniqueName",
      ok: String(member?.uniqueName) === a.uniqueName && String(member?.identityId) === a.userId,
      detail: `uniqueName=${String(member?.uniqueName ?? "n/a")}`,
    });

    checks.push({
      name: "member_profiles_present",
      ok: Boolean(profile),
      detail: profile ? `profileId=${a.profileId}` : "missing",
    });
    checks.push({
      name: "member_profiles_publicName",
      ok:
        String(profile?.publicName) === a.publicName &&
        String(profile?.userId) === a.userId &&
        String(profile?.displayName) === a.displayName,
      detail: `publicName=${String(profile?.publicName ?? "n/a")}`,
    });

    checks.push({
      name: "no_memberships_row",
      ok: !membership,
      detail: membership ? "membership present (unexpected)" : "none",
    });
    checks.push({
      name: "no_sessions",
      ok: sessions === 0,
      detail: `sessions=${sessions}`,
    });
    checks.push({
      name: "no_verification_tokens",
      ok: verificationTokens === 0,
      detail: `email_verification_tokens=${verificationTokens}`,
    });
    checks.push({
      name: "no_confirmation_codes",
      ok: confirmationCodes === 0,
      detail: `email_confirmation_codes=${confirmationCodes}`,
    });

    const stewardChecks: Array<{ label: string; ok: boolean; detail: string }> = [];
    for (const steward of PROTECTED_PRODUCTION_STEWARD_IDS) {
      const stewardAuth = await db
        .collection(MONGO_COLLECTIONS.authUsers)
        .findOne({ memberId: steward.memberId });
      const stewardMember = await db
        .collection(MONGO_COLLECTIONS.members)
        .findOne({ memberId: steward.memberId });
      const ok =
        Boolean(stewardAuth) &&
        Boolean(stewardMember) &&
        String(stewardAuth?.userId) === steward.userId &&
        stewardAuth?.role === "member" &&
        String(stewardMember?.identityId) === steward.userId;
      stewardChecks.push({
        label: steward.label,
        ok,
        detail: ok
          ? `memberId=${steward.memberId} role=member unchanged`
          : "missing or mutated",
      });
    }

    const adminCount = await db
      .collection(MONGO_COLLECTIONS.authUsers)
      .countDocuments({ role: "admin", status: "active" });
    const volodyIsAdmin = auth?.role === "admin";
    checks.push({
      name: "production_admin_count_includes_volody",
      ok: volodyIsAdmin && adminCount >= 1,
      detail: `active_admin_count=${adminCount}`,
    });

    const systemMediaAuth = await db.collection(MONGO_COLLECTIONS.authUsers).findOne({
      $or: [
        { displayName: SYSTEM_MEDIA_RECOVERY_OWNER },
        { email: SYSTEM_MEDIA_RECOVERY_OWNER },
        { memberId: SYSTEM_MEDIA_RECOVERY_OWNER },
      ],
    });
    const systemMediaMember = await db.collection(MONGO_COLLECTIONS.members).findOne({
      $or: [
        { displayName: SYSTEM_MEDIA_RECOVERY_OWNER },
        { uniqueName: SYSTEM_MEDIA_RECOVERY_OWNER },
        { memberId: SYSTEM_MEDIA_RECOVERY_OWNER },
      ],
    });
    checks.push({
      name: "system_media_recovery_non_identity",
      ok: !systemMediaAuth && !systemMediaMember,
      detail:
        !systemMediaAuth && !systemMediaMember
          ? "NON_IDENTITY (no auth_users/members bootstrap)"
          : "UNEXPECTED identity documents present",
    });

    const allOk =
      checks.every((row) => row.ok) && stewardChecks.every((row) => row.ok);

    const payload = {
      tool: "verify-production-admin-identity",
      database: config.database,
      ok: allOk,
      verdict: allOk ? "PASS" : "FAIL",
      admin: {
        label: a.label,
        memberId: a.memberId,
        userId: a.userId,
        profileId: a.profileId,
        displayName: a.displayName,
        publicName: a.publicName,
        uniqueName: a.uniqueName,
        emailMasked: maskEmail(typeof auth?.email === "string" ? auth.email : undefined),
        authRole: auth?.role ?? null,
        memberRoles: member?.roles ?? null,
        status: auth?.status ?? null,
        emailVerificationStatus: auth?.emailVerificationStatus ?? null,
      },
      checks,
      protectedStewards: stewardChecks,
      activeAdminCount: adminCount,
      systemMediaRecovery: "NON_IDENTITY",
    };

    const text = JSON.stringify(payload, null, 2);
    assertNoSecretLeak(text);
    console.log(text);
    if (!allOk) {
      process.exitCode = 1;
    }
  } finally {
    await disconnectMongoClient();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    JSON.stringify({
      tool: "verify-production-admin-identity",
      ok: false,
      error: message,
    }),
  );
  process.exitCode = 1;
});
