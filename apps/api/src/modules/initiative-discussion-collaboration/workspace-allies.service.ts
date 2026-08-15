import type { InitiativeAlly, PublicCommentAuthor } from "@hu/types";

import { listInitiativesBySteward } from "../initiatives/initiative.store.js";
import {
  listActiveAlliesByInitiative,
  listAlliesByParticipantId,
} from "./initiative-ally.store.js";
import { resolvePublicAuthorsForParticipantIds } from "./public-participant-identity.projection.js";

/**
 * Profile UX Pack 01 Part 9 — Workspace Allies aggregation.
 *
 * Documented meaning (Definition A of the three offered in the task spec,
 * the one requiring no new/inferred relationship beyond what
 * `InitiativeAlly` already models): the signed-in Participant's "Allies"
 * are the Participants with an ACTIVE Ally relationship on an Initiative
 * THEY steward — i.e. the people currently collaborating with them on
 * something they lead. This is the direct counterpart of the
 * "Collaborations" count below, which is the same relationship viewed from
 * the other side (Initiatives where the signed-in Participant is
 * themselves the active Ally, collaborating under someone else's
 * stewardship). The two are intentionally NOT symmetrized into a single
 * "peer network" — that would infer a relationship (ally-to-ally,
 * ally-to-steward-when-I'm-the-ally) the current domain model does not
 * actually record, which Part 9 explicitly warns against ("do not invent
 * global friendship semantics").
 */
export interface WorkspaceAllyEntry {
  participantId: string;
  author: PublicCommentAuthor;
  /** Number of the signed-in Participant's own Initiatives this Ally is active on. */
  sharedInitiativeCount: number;
}

export interface WorkspaceAlliesDependencies {
  listInitiativesStewardedBy: (participantId: string) => Array<{ initiativeId: string }>;
  listActiveAlliesByInitiative: (initiativeId: string) => Promise<InitiativeAlly[]>;
  listAlliesByParticipantId: (participantId: string) => Promise<InitiativeAlly[]>;
  resolveAuthorsForParticipantIds: (
    participantIds: readonly string[],
  ) => Promise<Map<string, PublicCommentAuthor>>;
}

const defaultWorkspaceAlliesDependencies: WorkspaceAlliesDependencies = {
  listInitiativesStewardedBy: listInitiativesBySteward,
  listActiveAlliesByInitiative,
  listAlliesByParticipantId,
  resolveAuthorsForParticipantIds: resolvePublicAuthorsForParticipantIds,
};

/**
 * "Allies" (Part 9/11/10) — unique, active-Ally Participants across every
 * Initiative the signed-in Participant stewards, deduplicated by
 * `participantId`. `sharedInitiativeCount` counts how many of the
 * signed-in Participant's OWN Initiatives that Ally is active on (kept
 * optional-in-spirit — Part 9 says the widget must not depend on it — but
 * always computed here since it falls out of the aggregation for free).
 */
export async function listWorkspaceAlliesForParticipant(
  participantId: string,
  deps: WorkspaceAlliesDependencies = defaultWorkspaceAlliesDependencies,
): Promise<WorkspaceAllyEntry[]> {
  const stewardedInitiatives = deps.listInitiativesStewardedBy(participantId);

  if (stewardedInitiatives.length === 0) {
    return [];
  }

  const alliesByInitiative = await Promise.all(
    stewardedInitiatives.map((initiative) =>
      deps.listActiveAlliesByInitiative(initiative.initiativeId),
    ),
  );

  const sharedInitiativeCountByParticipantId = new Map<string, number>();

  for (const allies of alliesByInitiative) {
    for (const ally of allies) {
      sharedInitiativeCountByParticipantId.set(
        ally.participantId,
        (sharedInitiativeCountByParticipantId.get(ally.participantId) ?? 0) + 1,
      );
    }
  }

  const allyParticipantIds = [...sharedInitiativeCountByParticipantId.keys()];
  const authorsByParticipantId = await deps.resolveAuthorsForParticipantIds(allyParticipantIds);

  return allyParticipantIds
    .map((id) => ({
      participantId: id,
      author: authorsByParticipantId.get(id) ?? { displayName: "Participant" },
      sharedInitiativeCount: sharedInitiativeCountByParticipantId.get(id) ?? 1,
    }))
    .sort(
      (left, right) =>
        right.sharedInitiativeCount - left.sharedInitiativeCount ||
        left.author.displayName.localeCompare(right.author.displayName),
    );
}

/**
 * "Collaborations" (Part 11) — count of Initiatives where the signed-in
 * Participant is THEMSELVES an active Ally (collaborating on someone
 * else's Initiative). Deliberately independent of "Allies" above — see the
 * module doc comment.
 */
export async function countActiveCollaborationsForParticipant(
  participantId: string,
  deps: WorkspaceAlliesDependencies = defaultWorkspaceAlliesDependencies,
): Promise<number> {
  const ownAllyRows = await deps.listAlliesByParticipantId(participantId);
  return ownAllyRows.filter((ally) => ally.status === "active").length;
}
