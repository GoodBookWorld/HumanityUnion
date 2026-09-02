import { randomUUID } from "node:crypto";

import type {
  InitiativeCollaborationChannelHistoryResult,
  InitiativeCollaborationChannelMessage,
  InitiativeCollaborationChannelMessageView,
  InitiativeCollaborationChannelReadState,
  InitiativeCollaborationChannelSummary,
  InitiativeCollaborationSystemEventKind,
} from "@hu/types";

import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { listActiveAlliesByInitiative } from "../initiative-discussion-collaboration/initiative-ally.store.js";
import { resolvePublicAuthorsForParticipantIds } from "../initiative-discussion-collaboration/public-participant-identity.projection.js";

import {
  resolveInitiativeCollaborationChannelAccess,
  type InitiativeCollaborationChannelAccessDependencies,
} from "./initiative-collaboration-channel-access.js";
import {
  emitInitiativeCollaborationChannelMessageNotification,
  emitInitiativeCollaborationChannelSystemEventNotification,
  markInitiativeCollaborationChannelNotificationsRead,
} from "./initiative-collaboration-channel-notifications.js";
import { validateCollaborationChannelMessageText } from "./initiative-collaboration-channel.validators.js";
import {
  countUnreadCollaborationChannelMessages,
  findCollaborationChannelReadState,
  findLastCollaborationChannelMessage,
  insertCollaborationChannelMessageDocument,
  listCollaborationChannelMessagesBefore,
  listRecentCollaborationChannelMessages,
  upsertCollaborationChannelReadState,
} from "./persistence/initiative-collaboration-channel.repository.js";

/**
 * Communication UX Pack 03.5 — the Initiative Collaboration Channel
 * service. One persistent channel per Initiative (Part 1/9): every
 * function here is keyed by `initiativeId` alone, never a separate
 * "channelId". Text-only (Part 4): no attachment/emoji/reaction fields
 * exist anywhere in this module.
 */

export interface InitiativeCollaborationChannelDependencies {
  resolveAccess: typeof resolveInitiativeCollaborationChannelAccess;
  accessDeps?: InitiativeCollaborationChannelAccessDependencies;
  insertMessage: typeof insertCollaborationChannelMessageDocument;
  listRecentMessages: typeof listRecentCollaborationChannelMessages;
  listMessagesBefore: typeof listCollaborationChannelMessagesBefore;
  findLastMessage: typeof findLastCollaborationChannelMessage;
  findReadState: typeof findCollaborationChannelReadState;
  upsertReadState: typeof upsertCollaborationChannelReadState;
  countUnreadMessages: typeof countUnreadCollaborationChannelMessages;
  resolveIdentities(
    participantIds: readonly string[],
  ): Promise<Map<string, { displayName: string; avatarUrl?: string; profileUrl?: string }>>;
  listActiveAllies(initiativeId: string): Promise<Array<{ participantId: string }>>;
  getInitiativeTitle(initiativeId: string): string | null;
  /** Used only by `postInitiativeCollaborationSystemEvent`, which has no authorized caller identity to run through `resolveAccess` — injectable so it stays testable without a real persisted Initiative. */
  getInitiative(initiativeId: string): { initiativeId: string; stewardId: string } | null;
  notifyNewMessage: typeof emitInitiativeCollaborationChannelMessageNotification;
  notifySystemEvent: typeof emitInitiativeCollaborationChannelSystemEventNotification;
}

const defaultDependencies: InitiativeCollaborationChannelDependencies = {
  resolveAccess: resolveInitiativeCollaborationChannelAccess,
  insertMessage: insertCollaborationChannelMessageDocument,
  listRecentMessages: listRecentCollaborationChannelMessages,
  listMessagesBefore: listCollaborationChannelMessagesBefore,
  findLastMessage: findLastCollaborationChannelMessage,
  findReadState: findCollaborationChannelReadState,
  upsertReadState: upsertCollaborationChannelReadState,
  countUnreadMessages: countUnreadCollaborationChannelMessages,
  resolveIdentities: resolvePublicAuthorsForParticipantIds,
  listActiveAllies: listActiveAlliesByInitiative,
  getInitiativeTitle(initiativeId) {
    return getInitiativeById(initiativeId)?.title ?? null;
  },
  getInitiative(initiativeId) {
    const initiative = getInitiativeById(initiativeId);
    return initiative ? { initiativeId: initiative.initiativeId, stewardId: initiative.stewardId } : null;
  },
  notifyNewMessage: emitInitiativeCollaborationChannelMessageNotification,
  notifySystemEvent: emitInitiativeCollaborationChannelSystemEventNotification,
};

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Part 7/13 — every current Channel access holder except `excludeParticipantId`
 * (the actor who triggered the write — they already know). One Active
 * Allies read, deduplicated defensively exactly like
 * `initiative-active-allies.service.ts`. Filtering here (not only inside
 * the notification helper's own defensive self-check) makes "never notify
 * the actor" an explicit, independently testable service-level guarantee.
 */
async function listOtherChannelParticipantIds(
  initiativeId: string,
  stewardId: string,
  excludeParticipantId: string | undefined,
  deps: InitiativeCollaborationChannelDependencies,
): Promise<string[]> {
  const activeAllies = await deps.listActiveAllies(initiativeId);
  const uniqueAllyIds = new Set(
    activeAllies.map((ally) => ally.participantId).filter((id) => id !== stewardId),
  );

  return [stewardId, ...uniqueAllyIds].filter((id) => id !== excludeParticipantId);
}

function buildMessageView(
  message: InitiativeCollaborationChannelMessage,
  viewerParticipantId: string,
  stewardId: string,
  identities: Map<string, { displayName: string; avatarUrl?: string; profileUrl?: string }>,
): InitiativeCollaborationChannelMessageView {
  if (message.type === "system_event") {
    return {
      messageId: message.messageId,
      type: "system_event",
      systemEventKind: message.systemEventKind,
      ...(message.systemEventSubjectDisplayName !== undefined
        ? { systemEventSubjectDisplayName: message.systemEventSubjectDisplayName }
        : {}),
      text: message.text,
      createdAt: message.createdAt,
      isOwnMessage: false,
    };
  }

  const senderParticipantId = message.senderParticipantId ?? "";
  const identity = identities.get(senderParticipantId);

  return {
    messageId: message.messageId,
    type: "participant_message",
    sender: {
      participantId: senderParticipantId,
      displayName: identity?.displayName ?? "Participant",
      avatarUrl: identity?.avatarUrl,
      profileUrl: identity?.profileUrl,
      role: senderParticipantId === stewardId ? "author" : "ally",
    },
    text: message.text,
    createdAt: message.createdAt,
    isOwnMessage: senderParticipantId === viewerParticipantId,
  };
}

/** Part 4 — Composer send. Text-only; validated exactly like Direct Messaging's rule (independent copy, Part 1). */
export async function sendInitiativeCollaborationChannelMessage(
  identity: RequestIdentity,
  initiativeId: string,
  rawText: unknown,
  deps: InitiativeCollaborationChannelDependencies = defaultDependencies,
): Promise<InitiativeCollaborationChannelMessageView> {
  const access = await deps.resolveAccess(initiativeId, identity.participantId, deps.accessDeps);
  const text = validateCollaborationChannelMessageText(rawText);

  const message: InitiativeCollaborationChannelMessage = {
    messageId: randomUUID(),
    initiativeId,
    type: "participant_message",
    senderParticipantId: identity.participantId,
    text,
    createdAt: nowIso(),
  };

  await deps.insertMessage(message);

  const recipientParticipantIds = await listOtherChannelParticipantIds(
    initiativeId,
    access.stewardId,
    identity.participantId,
    deps,
  );

  for (const recipientParticipantId of recipientParticipantIds) {
    deps.notifyNewMessage({
      recipientParticipantId,
      actorParticipantId: identity.participantId,
      initiativeId,
    });
  }

  const identityInfo = (await deps.resolveIdentities([identity.participantId])).get(identity.participantId);

  return {
    messageId: message.messageId,
    type: "participant_message",
    sender: {
      participantId: identity.participantId,
      displayName: identityInfo?.displayName ?? "Participant",
      avatarUrl: identityInfo?.avatarUrl,
      profileUrl: identityInfo?.profileUrl,
      role: access.role === "author" ? "author" : "ally",
    },
    text: message.text,
    createdAt: message.createdAt,
    isOwnMessage: true,
  };
}

const DEFAULT_HISTORY_PAGE_SIZE = 50;

/** Part 4 — chronological History. Newest bounded page or an older cursor page, always returned oldest-first for display. */
export async function listInitiativeCollaborationChannelHistory(
  identity: RequestIdentity,
  initiativeId: string,
  options: { beforeCreatedAt?: string; beforeMessageId?: string; limit?: number } = {},
  deps: InitiativeCollaborationChannelDependencies = defaultDependencies,
): Promise<InitiativeCollaborationChannelHistoryResult> {
  const access = await deps.resolveAccess(initiativeId, identity.participantId, deps.accessDeps);
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_HISTORY_PAGE_SIZE, 1), 100);

  const { messages, hasMore } =
    options.beforeCreatedAt && options.beforeMessageId
      ? await deps.listMessagesBefore(
          initiativeId,
          { createdAt: options.beforeCreatedAt, messageId: options.beforeMessageId },
          limit,
        )
      : await deps.listRecentMessages(initiativeId, limit);

  const chronological = [...messages].reverse();

  const senderParticipantIds = [
    ...new Set(
      chronological
        .filter((message) => message.type === "participant_message" && message.senderParticipantId)
        .map((message) => message.senderParticipantId as string),
    ),
  ];
  const identities = await deps.resolveIdentities(senderParticipantIds);

  const views = chronological.map((message) =>
    buildMessageView(message, identity.participantId, access.stewardId, identities),
  );

  return {
    initiativeId,
    messages: views,
    hasMoreOlderMessages: hasMore,
  };
}

/** Part 6 — idempotent mark-read: always advances to "now", which correctly zeroes unread even when the channel has no messages yet. */
export async function markInitiativeCollaborationChannelRead(
  identity: RequestIdentity,
  initiativeId: string,
  deps: InitiativeCollaborationChannelDependencies = defaultDependencies,
): Promise<InitiativeCollaborationChannelReadState> {
  await deps.resolveAccess(initiativeId, identity.participantId, deps.accessDeps);

  const lastMessage = await deps.findLastMessage(initiativeId);
  const readState: InitiativeCollaborationChannelReadState = {
    initiativeId,
    participantId: identity.participantId,
    lastReadAt: nowIso(),
    lastReadMessageId: lastMessage?.messageId ?? null,
  };

  await deps.upsertReadState(readState);

  // Fire-and-forget, mirroring every other notification side-effect in this
  // module: clearing the Notification Center's mirror of "conversation
  // read" must never block or fail the channel's own durable read-state
  // write above.
  void markInitiativeCollaborationChannelNotificationsRead({
    participantId: identity.participantId,
    initiativeId,
  }).catch(() => {});

  return readState;
}

/** Part 4/6/8 — header + unread summary; reuses the same Active Allies read the participants panel uses (Part 13, never a second query). */
export async function getInitiativeCollaborationChannelSummary(
  identity: RequestIdentity,
  initiativeId: string,
  deps: InitiativeCollaborationChannelDependencies = defaultDependencies,
): Promise<InitiativeCollaborationChannelSummary> {
  const access = await deps.resolveAccess(initiativeId, identity.participantId, deps.accessDeps);

  const [activeAllies, readState] = await Promise.all([
    deps.listActiveAllies(initiativeId),
    deps.findReadState(initiativeId, identity.participantId),
  ]);

  const uniqueAllyParticipantIds = new Set(
    activeAllies.map((ally) => ally.participantId).filter((id) => id !== access.stewardId),
  );

  const unreadCount = await deps.countUnreadMessages(
    initiativeId,
    identity.participantId,
    readState?.lastReadAt ?? null,
  );

  return {
    initiativeId,
    initiativeTitle: deps.getInitiativeTitle(initiativeId) ?? "",
    participantCount: uniqueAllyParticipantIds.size + 1,
    unreadCount,
    viewerRole: access.role,
  };
}

/**
 * Part 5/10/12 — the Channel's clean extension point for future lifecycle
 * modules (Collaboration Sessions, Petition, Collective Decision, etc.):
 * post a System Event with no human actor performing the write. Never
 * authorization-gated on a caller identity (it is always triggered by an
 * already-authorized workflow, e.g. an Ally acceptance), but recipients
 * are still exactly the Channel's access holders (Part 13 — no duplicate
 * participant query beyond the one Active Allies read already required).
 */
const SYSTEM_EVENT_TEXT_BUILDERS: Record<InitiativeCollaborationSystemEventKind, (subjectDisplayName?: string) => string> = {
  ally_joined: (name) => `${name ?? "A new Ally"} joined the Collaboration Channel.`,
  collaboration_accepted: (name) => `${name ?? "A collaboration request"} was accepted.`,
  session_scheduled: () => "A collaboration session was scheduled.",
  petition_published: () => "The petition was published.",
  collective_decision_updated: () => "The Collective Decision was updated.",
};

export async function postInitiativeCollaborationSystemEvent(
  input: {
    initiativeId: string;
    kind: InitiativeCollaborationSystemEventKind;
    /** The Participant the event is about (e.g. the Ally who joined) — used only to build the text, never for authorization. */
    subjectParticipantId?: string;
    /** The Participant who triggered the underlying action — excluded from the notification fan-out (they already know). */
    actorParticipantId?: string;
  },
  deps: InitiativeCollaborationChannelDependencies = defaultDependencies,
): Promise<void> {
  const initiative = deps.getInitiative(input.initiativeId);

  if (!initiative) {
    return;
  }

  const subjectIdentity = input.subjectParticipantId
    ? (await deps.resolveIdentities([input.subjectParticipantId])).get(input.subjectParticipantId)
    : undefined;

  const message: InitiativeCollaborationChannelMessage = {
    messageId: randomUUID(),
    initiativeId: input.initiativeId,
    type: "system_event",
    systemEventKind: input.kind,
    ...(subjectIdentity?.displayName !== undefined
      ? { systemEventSubjectDisplayName: subjectIdentity.displayName }
      : {}),
    text: SYSTEM_EVENT_TEXT_BUILDERS[input.kind](subjectIdentity?.displayName),
    createdAt: nowIso(),
  };

  await deps.insertMessage(message);

  const recipientParticipantIds = await listOtherChannelParticipantIds(
    input.initiativeId,
    initiative.stewardId,
    input.actorParticipantId,
    deps,
  );

  for (const recipientParticipantId of recipientParticipantIds) {
    deps.notifySystemEvent({
      recipientParticipantId,
      actorParticipantId: input.actorParticipantId,
      initiativeId: input.initiativeId,
    });
  }
}
