import {
  APPROVED_HISTORICAL_INITIATIVES,
  APPROVED_HISTORICAL_PARTICIPANTS,
  BOOTSTRAP_INITIATIVE_ID,
  EXPECTED_TARGET_HISTORICAL_INITIATIVE_COUNT,
  EXPECTED_TARGET_PARTICIPANT_COUNT,
} from "./constants.js";
import { maskEmail, normalizeEmail } from "./redact.js";
import type {
  InitiativePlanItem,
  InitiativeRecord,
  MigrationAction,
  MigrationPlan,
  ParticipantPlanItem,
  SafeAuthShell,
  SafeMemberRecord,
  SafeMembershipRecord,
  SafeProfileRecord,
} from "./types.js";

export interface MigrationSourceBundle {
  sourceDatabase: string;
  targetDatabase: string;
  fileRuntimePath: string;
  sourceAuthByMemberId: Map<string, SafeAuthShell>;
  sourceMembersById: Map<string, SafeMemberRecord>;
  sourceProfilesByUserId: Map<string, SafeProfileRecord>;
  sourceMembershipsByMemberId: Map<string, SafeMembershipRecord[]>;
  targetAuthByUserId: Map<string, SafeAuthShell>;
  targetAuthByEmail: Map<string, SafeAuthShell>;
  targetAuthByMemberId: Map<string, SafeAuthShell>;
  targetMembersById: Map<string, SafeMemberRecord>;
  targetProfilesByUserId: Map<string, SafeProfileRecord>;
  targetMembershipsByMemberId: Map<string, SafeMembershipRecord[]>;
  targetInitiativesById: Map<string, InitiativeRecord>;
  fileInitiativesById: Map<string, InitiativeRecord>;
  relatedCountsByInitiativeId: Map<
    string,
    { analyses: number; proposals: number; revisions: number; petitionDrafts: number }
  >;
  stagingAdmin: SafeAuthShell | null;
}

function decideIdentityAction(input: {
  source: SafeAuthShell;
  targetByUserId: SafeAuthShell | undefined;
  targetByEmail: SafeAuthShell | undefined;
  targetByMemberId: SafeAuthShell | undefined;
  protectedAdmin: SafeAuthShell | null;
}): { action: MigrationAction; reason: string } {
  const { source, targetByUserId, targetByEmail, targetByMemberId, protectedAdmin } = input;

  if (
    protectedAdmin &&
    (protectedAdmin.userId === source.userId ||
      protectedAdmin.memberId === source.memberId ||
      normalizeEmail(protectedAdmin.email) === normalizeEmail(source.email))
  ) {
    return {
      action: "conflict",
      reason: "Source identity collides with protected staging administrator — refuse.",
    };
  }

  if (targetByUserId) {
    if (
      targetByUserId.memberId === source.memberId &&
      normalizeEmail(targetByUserId.email) === normalizeEmail(source.email)
    ) {
      return { action: "skip_existing", reason: "Identical userId/memberId/email already in target." };
    }
    return {
      action: "conflict",
      reason: "Same userId exists in target with different identity fields.",
    };
  }

  if (targetByEmail) {
    if (targetByEmail.userId === source.userId && targetByEmail.memberId === source.memberId) {
      return { action: "skip_existing", reason: "Identical email/user/member already in target." };
    }
    return {
      action: "conflict",
      reason: "Same email exists in target under a different userId/memberId.",
    };
  }

  if (targetByMemberId) {
    if (
      targetByMemberId.userId === source.userId &&
      normalizeEmail(targetByMemberId.email) === normalizeEmail(source.email)
    ) {
      return { action: "skip_existing", reason: "Identical memberId already linked in target." };
    }
    return {
      action: "conflict",
      reason: "Same memberId exists in target with different auth linkage.",
    };
  }

  return {
    action: "create",
    reason: "No canonical ID or email collision; safe to create auth shell with password reset.",
  };
}

function decideMemberAction(
  source: SafeMemberRecord | undefined,
  target: SafeMemberRecord | undefined,
): { action: MigrationAction; reason: string } {
  if (!source) {
    // Auth exists without Member row (observed for historical Vlad/Michael in dev).
    // Pack 02 synthesizes a compatible Member from the auth shell — not a hard conflict.
    if (!target) {
      return {
        action: "transform",
        reason: "Source member missing; synthesize Member from auth shell (memberId + displayName).",
      };
    }
    return { action: "skip_existing", reason: "Target member already present; source member absent." };
  }
  if (!target) {
    return { action: "create", reason: "Member absent in target." };
  }
  if (target.memberId === source.memberId) {
    return { action: "skip_existing", reason: "Member already present." };
  }
  return { action: "conflict", reason: "Unexpected member collision." };
}

function decideProfileAction(
  source: SafeProfileRecord | undefined,
  target: SafeProfileRecord | undefined,
): { action: MigrationAction; reason: string } {
  if (!source) {
    return { action: "transform", reason: "No source profile; may create minimal profile on execute." };
  }
  if (!target) {
    return { action: "create", reason: "Profile absent in target." };
  }
  if (target.userId === source.userId) {
    return { action: "skip_existing", reason: "Profile already present for userId." };
  }
  return { action: "conflict", reason: "Profile userId mismatch." };
}

function decideInitiativeAction(
  source: InitiativeRecord | undefined,
  target: InitiativeRecord | undefined,
  expectedSteward: string,
): { action: MigrationAction; reason: string } {
  if (!source) {
    return {
      action: "conflict",
      reason: "Approved Initiative missing from file runtime source — Pack 01 drift.",
    };
  }
  if (source.stewardId !== expectedSteward) {
    return {
      action: "conflict",
      reason: `Steward mismatch: file has ${source.stewardId}, expected ${expectedSteward}.`,
    };
  }
  if (!target) {
    return {
      action: "transform",
      reason: "File-runtime Initiative will be imported into staging Mongo (preserve ID + steward).",
    };
  }
  if (target.stewardId === source.stewardId && target.title === source.title) {
    return { action: "skip_existing", reason: "Initiative already present with matching steward/title." };
  }
  return {
    action: "conflict",
    reason: "Initiative ID exists in target with different steward or title — refuse overwrite.",
  };
}

/**
 * Pure planner — no I/O. Display names are never used as merge keys.
 */
export function buildMigrationPlan(bundle: MigrationSourceBundle): MigrationPlan {
  const conflicts: string[] = [];
  const integrityIssues: string[] = [];
  const admin = bundle.stagingAdmin;

  if (!admin || admin.role !== "admin") {
    integrityIssues.push("Target staging administrator (role=admin) was not found.");
  }

  const participants: ParticipantPlanItem[] = [];

  for (const approved of APPROVED_HISTORICAL_PARTICIPANTS) {
    const sourceAuth = bundle.sourceAuthByMemberId.get(approved.memberId);
    if (!sourceAuth) {
      conflicts.push(`Missing source auth for approved Participant ${approved.key} (${approved.memberId}).`);
      participants.push({
        key: approved.key,
        memberId: approved.memberId,
        userId: null,
        displayName: approved.displayName,
        emailMasked: null,
        classification: approved.classification,
        action: "conflict",
        reason: "Source auth user missing — Pack 01 assumption drift.",
        authAction: "conflict",
        memberAction: "conflict",
        profileAction: "conflict",
        membershipAction: "none",
      });
      continue;
    }

    // Explicit non-merge: displayName "Vlad" must not imply admin equality.
    if (
      approved.key === "historical_vlad_gmail" &&
      admin &&
      sourceAuth.displayName === admin.displayName &&
      normalizeEmail(sourceAuth.email) !== normalizeEmail(admin.email)
    ) {
      // Expected — not a conflict.
    }

    const authDecision = decideIdentityAction({
      source: sourceAuth,
      targetByUserId: bundle.targetAuthByUserId.get(sourceAuth.userId),
      targetByEmail: bundle.targetAuthByEmail.get(normalizeEmail(sourceAuth.email)),
      targetByMemberId: bundle.targetAuthByMemberId.get(sourceAuth.memberId),
      protectedAdmin: admin,
    });

    const sourceMember = bundle.sourceMembersById.get(approved.memberId);
    const memberDecision = decideMemberAction(
      sourceMember,
      bundle.targetMembersById.get(approved.memberId),
    );

    const sourceProfile = bundle.sourceProfilesByUserId.get(sourceAuth.userId);
    const profileDecision = decideProfileAction(
      sourceProfile,
      bundle.targetProfilesByUserId.get(sourceAuth.userId),
    );

    const sourceMemberships = bundle.sourceMembershipsByMemberId.get(approved.memberId) ?? [];
    const targetMemberships = bundle.targetMembershipsByMemberId.get(approved.memberId) ?? [];
    let membershipAction: ParticipantPlanItem["membershipAction"] = "none";
    if (sourceMemberships.length > 0 && targetMemberships.length === 0) {
      membershipAction = "create";
    } else if (sourceMemberships.length > 0 && targetMemberships.length > 0) {
      membershipAction = "skip_existing";
    }

    if (authDecision.action === "conflict") {
      conflicts.push(`${approved.key}: ${authDecision.reason}`);
    }
    if (memberDecision.action === "conflict") {
      conflicts.push(`${approved.key} member: ${memberDecision.reason}`);
    }

    const overall: MigrationAction =
      authDecision.action === "conflict" ||
      memberDecision.action === "conflict" ||
      profileDecision.action === "conflict"
        ? "conflict"
        : authDecision.action === "skip_existing" && memberDecision.action === "skip_existing"
          ? "skip_existing"
          : approved.classification === "SEPARATE_PARTICIPANT"
            ? "transform"
            : "create";

    participants.push({
      key: approved.key,
      memberId: approved.memberId,
      userId: sourceAuth.userId,
      displayName: sourceAuth.displayName,
      emailMasked: maskEmail(sourceAuth.email),
      classification: approved.classification,
      action: overall,
      reason:
        approved.classification === "SEPARATE_PARTICIPANT"
          ? "Migrate as SEPARATE_PARTICIPANT; do not merge with staging-admin Vlad HUWS."
          : authDecision.reason,
      authAction: authDecision.action,
      memberAction: memberDecision.action,
      profileAction: profileDecision.action,
      membershipAction,
    });
  }

  const initiatives: InitiativePlanItem[] = [];
  let relatedTotals = { analyses: 0, proposals: 0, revisions: 0, petitionDrafts: 0 };

  for (const approved of APPROVED_HISTORICAL_INITIATIVES) {
    const fileInitiative = bundle.fileInitiativesById.get(approved.initiativeId);
    const targetInitiative = bundle.targetInitiativesById.get(approved.initiativeId);
    const decision = decideInitiativeAction(
      fileInitiative,
      targetInitiative,
      approved.stewardMemberId,
    );
    const related = bundle.relatedCountsByInitiativeId.get(approved.initiativeId) ?? {
      analyses: 0,
      proposals: 0,
      revisions: 0,
      petitionDrafts: 0,
    };
    relatedTotals = {
      analyses: relatedTotals.analyses + related.analyses,
      proposals: relatedTotals.proposals + related.proposals,
      revisions: relatedTotals.revisions + related.revisions,
      petitionDrafts: relatedTotals.petitionDrafts + related.petitionDrafts,
    };
    if (decision.action === "conflict") {
      conflicts.push(`${approved.initiativeId}: ${decision.reason}`);
    }
    initiatives.push({
      initiativeId: approved.initiativeId,
      title: approved.title,
      stewardMemberId: approved.stewardMemberId,
      action: decision.action,
      reason: decision.reason,
      related,
    });
  }

  const bootstrap = bundle.targetInitiativesById.get(BOOTSTRAP_INITIATIVE_ID);

  return {
    mode: "dry-run",
    sourceDatabase: bundle.sourceDatabase,
    targetDatabase: bundle.targetDatabase,
    fileRuntimePath: bundle.fileRuntimePath,
    stagingAdmin: {
      protected: Boolean(admin && admin.role === "admin"),
      userId: admin?.userId ?? null,
      memberId: admin?.memberId ?? null,
      emailMasked: admin ? maskEmail(admin.email) : null,
      role: admin?.role ?? null,
    },
    participants,
    initiatives,
    relatedArtifacts: relatedTotals,
    excludedLegacy: {
      activities: true,
      discussions: true,
      proposals: true,
      decisions: true,
    },
    expectedTargetCounts: {
      participantsApprox: EXPECTED_TARGET_PARTICIPANT_COUNT,
      historicalInitiatives: EXPECTED_TARGET_HISTORICAL_INITIATIVE_COUNT,
      bootstrapInitiativeRetained: Boolean(bootstrap),
    },
    conflicts,
    integrityIssues,
    bootstrapInitiative: {
      initiativeId: BOOTSTRAP_INITIATIVE_ID,
      recommendation: bootstrap
        ? "Retain bootstrap/sample Initiative; do not delete in Pack 02. Optionally exclude from operational public stats via existing admin visibility controls in a later pack."
        : "Bootstrap Initiative not present in target.",
    },
  };
}

/** Display-name equality must never merge Participants. */
export function shouldMergeByDisplayName(
  leftDisplayName: string,
  rightDisplayName: string,
  leftEmail: string,
  rightEmail: string,
): boolean {
  void leftDisplayName;
  void rightDisplayName;
  return normalizeEmail(leftEmail) === normalizeEmail(rightEmail);
}
