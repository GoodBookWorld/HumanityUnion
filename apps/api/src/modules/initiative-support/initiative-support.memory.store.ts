import { randomUUID } from "node:crypto";

import type { InitiativeSupportSignalKind } from "@hu/types";

type StoredSignal = "like" | "dislike";

export interface RegisteredSupportRecord {
  signalId: string;
  initiativeId: string;
  userId: string;
  signal: StoredSignal;
  audienceKind: "participants" | "members";
  createdAt: string;
  updatedAt: string;
}

export interface VisitorSupportRecord {
  signalId: string;
  initiativeId: string;
  visitorKey: string;
  signal: StoredSignal;
  createdAt: string;
  updatedAt: string;
}

export interface BookmarkRecord {
  initiativeId: string;
  userId: string;
  createdAt: string;
}

export interface ViewRecord {
  initiativeId: string;
  viewerKey: string;
  viewedAt: string;
}

const registeredSignals = new Map<string, RegisteredSupportRecord>();
const visitorSignals = new Map<string, VisitorSupportRecord>();
const bookmarks = new Map<string, BookmarkRecord>();
const views = new Map<string, ViewRecord>();

export function registeredKey(initiativeId: string, userId: string): string {
  return `${initiativeId}::${userId}`;
}

export function visitorStoreKey(initiativeId: string, visitorKeyValue: string): string {
  return `${initiativeId}::${visitorKeyValue}`;
}

export function bookmarkKey(initiativeId: string, userId: string): string {
  return `${initiativeId}::${userId}`;
}

export function viewKey(initiativeId: string, viewerKeyValue: string): string {
  return `${initiativeId}::${viewerKeyValue}`;
}

export function resetInitiativeSupportMemoryStore(): void {
  registeredSignals.clear();
  visitorSignals.clear();
  bookmarks.clear();
  views.clear();
}

export function getRegisteredSupportRecord(
  initiativeId: string,
  userId: string,
): RegisteredSupportRecord | undefined {
  return registeredSignals.get(registeredKey(initiativeId, userId));
}

export function upsertRegisteredSupportRecord(input: {
  initiativeId: string;
  userId: string;
  signal: StoredSignal;
  audienceKind: "participants" | "members";
}): RegisteredSupportRecord {
  const key = registeredKey(input.initiativeId, input.userId);
  const existing = registeredSignals.get(key);
  const now = new Date().toISOString();

  const record: RegisteredSupportRecord = {
    signalId: existing?.signalId ?? randomUUID(),
    initiativeId: input.initiativeId,
    userId: input.userId,
    signal: input.signal,
    audienceKind: input.audienceKind,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  registeredSignals.set(key, record);
  return record;
}

export function deleteRegisteredSupportRecord(initiativeId: string, userId: string): void {
  registeredSignals.delete(registeredKey(initiativeId, userId));
}

export function listRegisteredSupportRecords(initiativeId: string): RegisteredSupportRecord[] {
  return Array.from(registeredSignals.values()).filter(
    (record) => record.initiativeId === initiativeId,
  );
}

export function getVisitorSupportRecord(
  initiativeId: string,
  visitorKeyValue: string,
): VisitorSupportRecord | undefined {
  return visitorSignals.get(visitorStoreKey(initiativeId, visitorKeyValue));
}

export function upsertVisitorSupportRecord(input: {
  initiativeId: string;
  visitorKey: string;
  signal: StoredSignal;
}): VisitorSupportRecord {
  const key = visitorStoreKey(input.initiativeId, input.visitorKey);
  const existing = visitorSignals.get(key);
  const now = new Date().toISOString();

  const record: VisitorSupportRecord = {
    signalId: existing?.signalId ?? randomUUID(),
    initiativeId: input.initiativeId,
    visitorKey: input.visitorKey,
    signal: input.signal,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  visitorSignals.set(key, record);
  return record;
}

export function deleteVisitorSupportRecord(initiativeId: string, visitorKeyValue: string): void {
  visitorSignals.delete(visitorStoreKey(initiativeId, visitorKeyValue));
}

export function listVisitorSupportRecords(initiativeId: string): VisitorSupportRecord[] {
  return Array.from(visitorSignals.values()).filter(
    (record) => record.initiativeId === initiativeId,
  );
}

export function toggleBookmarkRecord(input: { initiativeId: string; userId: string }): boolean {
  const key = bookmarkKey(input.initiativeId, input.userId);
  const existing = bookmarks.get(key);

  if (existing) {
    bookmarks.delete(key);
    return false;
  }

  bookmarks.set(key, {
    initiativeId: input.initiativeId,
    userId: input.userId,
    createdAt: new Date().toISOString(),
  });

  return true;
}

export function hasBookmarkRecord(initiativeId: string, userId: string): boolean {
  return bookmarks.has(bookmarkKey(initiativeId, userId));
}

export function countBookmarkRecords(initiativeId: string): number {
  return Array.from(bookmarks.values()).filter((record) => record.initiativeId === initiativeId)
    .length;
}

export function countViewRecords(initiativeId: string): number {
  return Array.from(views.values()).filter((record) => record.initiativeId === initiativeId).length;
}

export function recordView(input: { initiativeId: string; viewerKey: string }): number {
  const key = viewKey(input.initiativeId, input.viewerKey);

  if (!views.has(key)) {
    views.set(key, {
      initiativeId: input.initiativeId,
      viewerKey: input.viewerKey,
      viewedAt: new Date().toISOString(),
    });
  }

  return countViewRecords(input.initiativeId);
}

export function getCurrentUserSignalMemory(input: {
  initiativeId: string;
  userId?: string | null;
  visitorKeyValue?: string | null;
}): InitiativeSupportSignalKind {
  if (input.userId) {
    return getRegisteredSupportRecord(input.initiativeId, input.userId)?.signal ?? "none";
  }

  if (input.visitorKeyValue) {
    return getVisitorSupportRecord(input.initiativeId, input.visitorKeyValue)?.signal ?? "none";
  }

  return "none";
}
