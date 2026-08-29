import type { Document } from "mongodb";

import {
  ACTOR_IDENTITY_FIELDS,
  APPROVED_PRODUCTION_PARTICIPANTS,
  SYSTEM_MEDIA_RECOVERY_OWNER,
  approvedMemberIdSet,
  approvedUserIdSet,
} from "./constants.js";
import type { MigrationClassification, ParticipantActorHit, ParticipantsReport } from "./types.js";

export interface ActorOccurrence {
  actorId: string;
  field: string;
  collection: string;
  classification: MigrationClassification;
  initiativeId: string | null;
}

export function collectActorOccurrencesFromDocument(input: {
  doc: Document;
  collection: string;
  classification: MigrationClassification;
  initiativeId: string | null;
}): ActorOccurrence[] {
  const out: ActorOccurrence[] = [];
  for (const field of ACTOR_IDENTITY_FIELDS) {
    const value = input.doc[field];
    if (typeof value === "string" && value.trim()) {
      out.push({
        actorId: value.trim(),
        field,
        collection: input.collection,
        classification: input.classification,
        initiativeId: input.initiativeId,
      });
    }
  }
  // Nested uploadedBy / owner on media-ish shapes
  const nestedOwner = input.doc.uploadedByParticipantId ?? input.doc.ownerParticipantId;
  if (typeof nestedOwner === "string" && nestedOwner.trim()) {
    // already covered if field listed; keep single path
    void nestedOwner;
  }
  return out;
}

export function classifyActorId(
  actorId: string,
  usedInMust: boolean,
  usedInConditional: boolean,
  resolved?: {
    memberId?: string | null;
    userId?: string | null;
    authRole?: string | null;
    label?: string | null;
  },
): ParticipantActorHit["classification"] {
  if (actorId === SYSTEM_MEDIA_RECOVERY_OWNER) {
    return "SYSTEM_ACTOR";
  }
  const memberSet = approvedMemberIdSet();
  const userSet = approvedUserIdSet();
  const resolvedMember = resolved?.memberId ?? null;
  const resolvedUser = resolved?.userId ?? null;
  if (
    memberSet.has(actorId) ||
    userSet.has(actorId) ||
    (resolvedMember && memberSet.has(resolvedMember)) ||
    (resolvedUser && userSet.has(resolvedUser))
  ) {
    return "APPROVED";
  }
  if (usedInMust) return "EXTERNAL_MUST";
  if (usedInConditional) return "EXTERNAL_CONDITIONAL";
  return "UNRESOLVED";
}

export function buildParticipantsReport(
  occurrences: ActorOccurrence[],
  resolveIdentity: (actorId: string) => {
    memberId: string | null;
    userId: string | null;
    authRole: string | null;
    label: string | null;
  },
): ParticipantsReport {
  const byId = new Map<
    string,
    {
      fields: Set<string>;
      collections: Set<string>;
      initiativeIds: Set<string>;
      must: boolean;
      conditional: boolean;
    }
  >();

  for (const occ of occurrences) {
    let row = byId.get(occ.actorId);
    if (!row) {
      row = {
        fields: new Set(),
        collections: new Set(),
        initiativeIds: new Set(),
        must: false,
        conditional: false,
      };
      byId.set(occ.actorId, row);
    }
    row.fields.add(occ.field);
    row.collections.add(occ.collection);
    if (occ.initiativeId) row.initiativeIds.add(occ.initiativeId);
    if (occ.classification === "MUST_MIGRATE" || occ.classification === "MUST_MIGRATE_IF_PRESENT") {
      row.must = true;
    }
    if (
      occ.classification === "CONDITIONAL_MIGRATE" ||
      occ.classification === "CONDITIONAL_SANITIZED"
    ) {
      row.conditional = true;
    }
  }

  const approved: ParticipantActorHit[] = [];
  const systemActors: ParticipantActorHit[] = [];
  const externalMust: ParticipantActorHit[] = [];
  const externalConditional: ParticipantActorHit[] = [];
  const unresolved: ParticipantActorHit[] = [];

  for (const [actorId, agg] of byId) {
    const resolved = resolveIdentity(actorId);
    const classification = classifyActorId(actorId, agg.must, agg.conditional, resolved);
    const label =
      resolved.label ??
      APPROVED_PRODUCTION_PARTICIPANTS.find(
        (p) => p.memberId === actorId || p.userId === actorId,
      )?.label ??
      null;

    const hit: ParticipantActorHit = {
      actorId,
      classification,
      label,
      fields: [...agg.fields].sort(),
      collections: [...agg.collections].sort(),
      initiativeIds: [...agg.initiativeIds].sort(),
      resolvedMemberId: resolved.memberId,
      resolvedUserId: resolved.userId,
      authRole: resolved.authRole,
    };

    if (classification === "APPROVED") approved.push(hit);
    else if (classification === "SYSTEM_ACTOR") systemActors.push(hit);
    else if (classification === "EXTERNAL_MUST") externalMust.push(hit);
    else if (classification === "EXTERNAL_CONDITIONAL") externalConditional.push(hit);
    else unresolved.push(hit);
  }

  return { approved, systemActors, externalMust, externalConditional, unresolved };
}

export function participantVerdictFromReport(report: ParticipantsReport): "PASS" | "FAIL" {
  if (report.externalMust.length > 0 || report.unresolved.length > 0) {
    return "FAIL";
  }
  return "PASS";
}
