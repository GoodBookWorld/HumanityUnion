import type { InitiativeSupportAudienceBreakdown, InitiativeSupportSignalKind } from "@hu/types";

import { findMembershipByUserId } from "../membership/membership.repository.js";
import {
  countBookmarkRecords,
  countViewRecords,
  deleteRegisteredSupportRecord,
  deleteVisitorSupportRecord,
  getCurrentUserSignalMemory,
  hasBookmarkRecord,
  listRegisteredSupportRecords,
  listVisitorSupportRecords,
  recordView,
  resetInitiativeSupportMemoryStore,
  toggleBookmarkRecord,
  upsertRegisteredSupportRecord,
  upsertVisitorSupportRecord,
} from "./initiative-support.memory.store.js";
import {
  countBookmarkRecordsMongo,
  countViewRecordsMongo,
  deleteInitiativeSupportRecordsByInitiativePrefix,
  deleteRegisteredSupportRecordMongo,
  deleteVisitorSupportRecordMongo,
  getCurrentUserSignalMongo,
  hasBookmarkRecordMongo,
  listRegisteredSupportRecordsMongo,
  listVisitorSupportRecordsMongo,
  recordViewMongo,
  toggleBookmarkRecordMongo,
  upsertRegisteredSupportRecordMongo,
  upsertVisitorSupportRecordMongo,
} from "./initiative-support.mongo.repository.js";
import {
  INITIATIVE_SUPPORT_PERSISTENCE_KEY,
  isEngagementMongoMode,
} from "../../infrastructure/mongodb/resolve-engagement-persistence.js";

function isMongoMode(): boolean {
  return isEngagementMongoMode(INITIATIVE_SUPPORT_PERSISTENCE_KEY);
}

async function resolveAudienceKind(userId: string): Promise<"participants" | "members"> {
  try {
    const membership = await findMembershipByUserId(userId);
    return membership?.status === "active_member" ? "members" : "participants";
  } catch {
    return "participants";
  }
}

function emptyBreakdown(): InitiativeSupportAudienceBreakdown {
  return {
    total: 0,
    participants: 0,
    members: 0,
    visitors: 0,
  };
}

function computeBreakdownFromRegistered(
  records: Array<{
    signal: "like" | "dislike";
    actorCohortSnapshot?: "participants" | "members";
    audienceKind?: "participants" | "members";
  }>,
  signal: "like" | "dislike",
): InitiativeSupportAudienceBreakdown {
  const breakdown = emptyBreakdown();

  for (const record of records) {
    if (record.signal !== signal) {
      continue;
    }

    breakdown.total += 1;
    const cohort = record.actorCohortSnapshot ?? record.audienceKind ?? "participants";

    if (cohort === "members") {
      breakdown.members += 1;
    } else {
      breakdown.participants += 1;
    }
  }

  return breakdown;
}

function computeBreakdownFromVisitors(
  records: Array<{ signal: "like" | "dislike" }>,
  signal: "like" | "dislike",
): InitiativeSupportAudienceBreakdown {
  const breakdown = emptyBreakdown();
  const count = records.filter((record) => record.signal === signal).length;
  breakdown.total = count;
  breakdown.visitors = count;
  return breakdown;
}

export async function getInitiativeSupportStatistics(input: {
  initiativeId: string;
  userId?: string | null;
  visitorKeyValue?: string | null;
}): Promise<{
  likes: InitiativeSupportAudienceBreakdown;
  dislikes: InitiativeSupportAudienceBreakdown;
  bookmarks: { total: number; available: boolean };
  views: { total: number; available: boolean };
  currentUserSignal: InitiativeSupportSignalKind;
  currentUserBookmarked: boolean;
  visitorSignalsAvailable: boolean;
}> {
  if (isMongoMode()) {
    const [registered, visitors, bookmarkTotal, viewTotal, currentUserSignal, bookmarked] =
      await Promise.all([
        listRegisteredSupportRecordsMongo(input.initiativeId),
        listVisitorSupportRecordsMongo(input.initiativeId),
        countBookmarkRecordsMongo(input.initiativeId),
        countViewRecordsMongo(input.initiativeId),
        getCurrentUserSignalMongo(input),
        input.userId
          ? hasBookmarkRecordMongo(input.initiativeId, input.userId)
          : Promise.resolve(false),
      ]);

    const likes = computeBreakdownFromRegistered(registered, "like");
    const dislikes = computeBreakdownFromRegistered(registered, "dislike");
    likes.visitors = computeBreakdownFromVisitors(visitors, "like").visitors;
    likes.total += likes.visitors;
    dislikes.visitors = computeBreakdownFromVisitors(visitors, "dislike").visitors;
    dislikes.total += dislikes.visitors;

    return {
      likes,
      dislikes,
      bookmarks: { total: bookmarkTotal, available: true },
      views: { total: viewTotal, available: true },
      currentUserSignal,
      currentUserBookmarked: bookmarked,
      visitorSignalsAvailable: true,
    };
  }

  const registered = listRegisteredSupportRecords(input.initiativeId);
  const visitors = listVisitorSupportRecords(input.initiativeId);
  const likes = computeBreakdownFromRegistered(registered, "like");
  const dislikes = computeBreakdownFromRegistered(registered, "dislike");
  likes.visitors = computeBreakdownFromVisitors(visitors, "like").visitors;
  likes.total += likes.visitors;
  dislikes.visitors = computeBreakdownFromVisitors(visitors, "dislike").visitors;
  dislikes.total += dislikes.visitors;

  return {
    likes,
    dislikes,
    bookmarks: {
      total: countBookmarkRecords(input.initiativeId),
      available: true,
    },
    views: {
      total: countViewRecords(input.initiativeId),
      available: true,
    },
    currentUserSignal: getCurrentUserSignalMemory(input),
    currentUserBookmarked: input.userId
      ? hasBookmarkRecord(input.initiativeId, input.userId)
      : false,
    visitorSignalsAvailable: true,
  };
}
export async function setInitiativeSupportSignal(input: {
  initiativeId: string;
  userId: string;
  signal: InitiativeSupportSignalKind;
}): Promise<InitiativeSupportSignalKind> {
  if (isMongoMode()) {
    if (input.signal === "none") {
      await deleteRegisteredSupportRecordMongo(input.initiativeId, input.userId);
      return "none";
    }

    const audienceKind = await resolveAudienceKind(input.userId);
    await upsertRegisteredSupportRecordMongo({
      initiativeId: input.initiativeId,
      actorUserId: input.userId,
      signal: input.signal,
      actorCohortSnapshot: audienceKind,
    });

    return input.signal;
  }

  if (input.signal === "none") {
    deleteRegisteredSupportRecord(input.initiativeId, input.userId);
    return "none";
  }

  const audienceKind = await resolveAudienceKind(input.userId);
  upsertRegisteredSupportRecord({
    initiativeId: input.initiativeId,
    userId: input.userId,
    signal: input.signal,
    audienceKind,
  });

  return input.signal;
}

export async function setVisitorInitiativeSupportSignal(input: {
  initiativeId: string;
  visitorKeyValue: string;
  signal: InitiativeSupportSignalKind;
}): Promise<InitiativeSupportSignalKind> {
  if (isMongoMode()) {
    if (input.signal === "none") {
      await deleteVisitorSupportRecordMongo(input.initiativeId, input.visitorKeyValue);
      return "none";
    }

    await upsertVisitorSupportRecordMongo({
      initiativeId: input.initiativeId,
      visitorKey: input.visitorKeyValue,
      signal: input.signal,
    });

    return input.signal;
  }

  if (input.signal === "none") {
    deleteVisitorSupportRecord(input.initiativeId, input.visitorKeyValue);
    return "none";
  }

  upsertVisitorSupportRecord({
    initiativeId: input.initiativeId,
    visitorKey: input.visitorKeyValue,
    signal: input.signal,
  });

  return input.signal;
}

export async function toggleInitiativeBookmark(input: {
  initiativeId: string;
  userId: string;
}): Promise<boolean> {
  if (isMongoMode()) {
    return toggleBookmarkRecordMongo(input);
  }

  return toggleBookmarkRecord(input);
}

export async function recordInitiativeView(input: {
  initiativeId: string;
  viewerKey: string;
}): Promise<number> {
  if (isMongoMode()) {
    return recordViewMongo(input);
  }

  return recordView(input);
}

export async function resetInitiativeSupportStoreForTests(): Promise<void> {
  if (isMongoMode()) {
    return;
  }

  resetInitiativeSupportMemoryStore();
}

export async function resetInitiativeSupportMongoForTests(prefix: string): Promise<void> {
  if (isMongoMode()) {
    await deleteInitiativeSupportRecordsByInitiativePrefix(prefix);
    return;
  }

  resetInitiativeSupportMemoryStore();
}
