import type { AuthUserRecord } from "../../auth/auth-user.types.js";
import { markAuthUserEmailVerified } from "../../auth/auth-user.repository.js";
import { findMemberProfileByUserId } from "../../member-profile/member-profile.repository.js";
import { enqueueDomainEvent } from "../../../infrastructure/outbox/outbox.repository.js";
import { runMongoTransaction } from "../../../infrastructure/mongodb/mongo-transaction.js";
import { getCorrelationContext } from "../../../shared/observability/correlation.js";
import { logger } from "../../../shared/observability/logger.js";
import { createMemberRegisteredEvent } from "../domain/member-registered.event.js";
import {
  MemberAlreadyRegisteredError,
  MemberRegistrationConflictError,
  MemberRegistrationTransactionError,
} from "../domain/member.errors.js";
import type { PersistedMemberRecord } from "../domain/member.types.js";
import {
  findMemberByIdentityId,
  insertMember,
} from "../infrastructure/member.repository.js";
import { writeCachedMember } from "../infrastructure/member-read-cache.js";
import { toMemberDomain } from "../infrastructure/member.persistence.js";

export type MemberRegistrationOutcome = "created" | "idempotent_replay";

export interface ConfirmMemberRegistrationResult {
  outcome: MemberRegistrationOutcome;
  member: PersistedMemberRecord;
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11_000
  );
}

function resolveUniqueName(authUser: AuthUserRecord, profileUniqueName: string | undefined): string {
  if (profileUniqueName?.trim()) {
    return profileUniqueName.trim();
  }

  const localPart = authUser.email.split("@")[0] ?? "member";
  const slugBase = localPart
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);

  return `${slugBase || "member"}-${authUser.memberId.slice(0, 8)}`;
}

async function loadRegistrationMemberInput(
  authUser: AuthUserRecord,
): Promise<{ memberId: string; identityId: string; displayName: string; uniqueName: string }> {
  const profile = await findMemberProfileByUserId(authUser.userId);

  return {
    memberId: authUser.memberId,
    identityId: authUser.userId,
    displayName: authUser.displayName,
    uniqueName: resolveUniqueName(authUser, profile?.publicName),
  };
}

export async function confirmMemberRegistration(
  authUser: AuthUserRecord,
  options: { correlationId?: string } = {},
): Promise<ConfirmMemberRegistrationResult> {
  const correlationId =
    options.correlationId ?? getCorrelationContext()?.correlationId ?? authUser.userId;

  logger.info("member.registration.started", {
    component: "member-registration",
    correlationId,
    memberId: authUser.memberId,
    identityId: authUser.userId,
  });

  const existingMember = await findMemberByIdentityId(authUser.userId);

  if (existingMember) {
    logger.info("member.registration.idempotent_replay", {
      component: "member-registration",
      correlationId,
      memberId: existingMember.memberId,
      identityId: existingMember.identityId,
      transactionResult: "skipped_existing_member",
    });

    return {
      outcome: "idempotent_replay",
      member: existingMember,
    };
  }

  const memberInput = await loadRegistrationMemberInput(authUser);

  try {
    const member = await runMongoTransaction(async (session) => {
      const duplicate = await findMemberByIdentityId(authUser.userId, { session });

      if (duplicate) {
        throw new MemberAlreadyRegisteredError(duplicate.memberId);
      }

      const verifiedUser = await markAuthUserEmailVerified(authUser.userId, { session });

      if (!verifiedUser) {
        throw new MemberRegistrationConflictError("Auth user could not be verified.");
      }

      const persistedMember = await insertMember(memberInput, { session });
      writeCachedMember(toMemberDomain(persistedMember));
      const event = createMemberRegisteredEvent({
        member: persistedMember,
        correlationId,
        actorId: authUser.userId,
      });

      await enqueueDomainEvent(event, { session });

      logger.info("domain_event.enqueued", {
        component: "member-registration",
        correlationId,
        memberId: persistedMember.memberId,
        identityId: persistedMember.identityId,
        eventId: event.eventId,
        eventName: event.eventName,
        transactionResult: "committed",
      });

      return persistedMember;
    });

    logger.info("member.registration.completed", {
      component: "member-registration",
      correlationId,
      memberId: member.memberId,
      identityId: member.identityId,
      transactionResult: "committed",
    });

    return {
      outcome: "created",
      member,
    };
  } catch (error) {
    if (error instanceof MemberAlreadyRegisteredError) {
      const replayMember = await findMemberByIdentityId(authUser.userId);

      if (replayMember) {
        logger.info("member.registration.idempotent_replay", {
          component: "member-registration",
          correlationId,
          memberId: replayMember.memberId,
          identityId: replayMember.identityId,
          transactionResult: "duplicate_key_replay",
        });

        return {
          outcome: "idempotent_replay",
          member: replayMember,
        };
      }
    }

    if (isDuplicateKeyError(error)) {
      const replayMember = await findMemberByIdentityId(authUser.userId);

      if (replayMember) {
        logger.info("member.registration.idempotent_replay", {
          component: "member-registration",
          correlationId,
          memberId: replayMember.memberId,
          identityId: replayMember.identityId,
          transactionResult: "duplicate_key_replay",
        });

        return {
          outcome: "idempotent_replay",
          member: replayMember,
        };
      }

      logger.warn("member.registration.conflict", {
        component: "member-registration",
        correlationId,
        memberId: authUser.memberId,
        identityId: authUser.userId,
        errorCode: "duplicate_key_unresolved",
      });

      throw new MemberRegistrationConflictError(
        "Member registration conflict could not be resolved safely.",
      );
    }

    logger.error("member.registration.failed", {
      component: "member-registration",
      correlationId,
      memberId: authUser.memberId,
      identityId: authUser.userId,
      errorCode:
        error instanceof Error && "code" in error
          ? String((error as { code?: string }).code)
          : "unknown",
      message: error instanceof Error ? error.message : String(error),
    });

    throw new MemberRegistrationTransactionError(
      "Member registration transaction failed.",
      error,
    );
  }
}
