import type { TrafficReferrerType } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import { trafficEventExpireAt } from "./traffic-analytics.constants.js";

export interface TrafficEventDocument {
  eventId: string;
  visitorId: string;
  sessionId: string;
  pathname: string;
  occurredAt: Date;
  referrerType: TrafficReferrerType;
  referrerHost?: string;
  countryCode?: string;
  regionCode?: string;
  cityName?: string;
  navigationId?: string;
  createdAt: Date;
  expireAt: Date;
}

export interface TrafficSessionDocument {
  sessionId: string;
  visitorId: string;
  startedAt: Date;
  lastSeenAt: Date;
  viewCount: number;
  firstPath: string;
  lastPath: string;
  countryCode?: string;
  createdAt: Date;
  updatedAt: Date;
  expireAt: Date;
}

function eventsCollection() {
  return getMongoCollection<TrafficEventDocument>(MONGO_COLLECTIONS.trafficEvents);
}

function sessionsCollection() {
  return getMongoCollection<TrafficSessionDocument>(MONGO_COLLECTIONS.trafficSessions);
}

export async function findTrafficSessionById(
  sessionId: string,
): Promise<TrafficSessionDocument | null> {
  return sessionsCollection().findOne({ sessionId });
}

export async function insertTrafficEvent(
  doc: Omit<TrafficEventDocument, "createdAt" | "expireAt"> & {
    createdAt?: Date;
    expireAt?: Date;
  },
): Promise<"inserted" | "duplicate"> {
  const createdAt = doc.createdAt ?? new Date();
  const expireAt = doc.expireAt ?? trafficEventExpireAt(doc.occurredAt);

  try {
    await eventsCollection().insertOne({
      ...doc,
      createdAt,
      expireAt,
    });
    return "inserted";
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: number }).code === 11000
    ) {
      return "duplicate";
    }
    throw error;
  }
}

export async function upsertTrafficSession(input: {
  sessionId: string;
  visitorId: string;
  occurredAt: Date;
  pathname: string;
  countryCode?: string;
  isNew: boolean;
}): Promise<void> {
  const expireAt = trafficEventExpireAt(input.occurredAt);

  if (input.isNew) {
    await sessionsCollection().updateOne(
      { sessionId: input.sessionId },
      {
        $setOnInsert: {
          sessionId: input.sessionId,
          visitorId: input.visitorId,
          startedAt: input.occurredAt,
          firstPath: input.pathname,
          createdAt: input.occurredAt,
          countryCode: input.countryCode,
        },
        $set: {
          lastSeenAt: input.occurredAt,
          lastPath: input.pathname,
          updatedAt: input.occurredAt,
          expireAt,
        },
        $inc: { viewCount: 1 },
      },
      { upsert: true },
    );
    return;
  }

  await sessionsCollection().updateOne(
    { sessionId: input.sessionId },
    {
      $set: {
        lastSeenAt: input.occurredAt,
        lastPath: input.pathname,
        updatedAt: input.occurredAt,
        expireAt,
        ...(input.countryCode ? { countryCode: input.countryCode } : {}),
      },
      $inc: { viewCount: 1 },
    },
  );
}

export async function aggregateTrafficSummary(start: Date, end: Date) {
  const [row] = await eventsCollection()
    .aggregate<{ views: number; visitors: number; sessions: number }>([
      { $match: { occurredAt: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: null,
          views: { $sum: 1 },
          visitors: { $addToSet: "$visitorId" },
          sessions: { $addToSet: "$sessionId" },
        },
      },
      {
        $project: {
          _id: 0,
          views: 1,
          visitors: { $size: "$visitors" },
          sessions: { $size: "$sessions" },
        },
      },
    ])
    .toArray();

  return row ?? { views: 0, visitors: 0, sessions: 0 };
}

export async function aggregateTrafficTopPages(start: Date, end: Date, limit = 25) {
  return eventsCollection()
    .aggregate<{ path: string; views: number; visitors: number }>([
      { $match: { occurredAt: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: "$pathname",
          views: { $sum: 1 },
          visitors: { $addToSet: "$visitorId" },
        },
      },
      {
        $project: {
          _id: 0,
          path: "$_id",
          views: 1,
          visitors: { $size: "$visitors" },
        },
      },
      { $sort: { views: -1, path: 1 } },
      { $limit: limit },
    ])
    .toArray();
}

export async function aggregateTrafficReferrers(start: Date, end: Date, limit = 25) {
  return eventsCollection()
    .aggregate<{ referrerType: TrafficReferrerType; host: string | null; views: number }>([
      { $match: { occurredAt: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: {
            referrerType: "$referrerType",
            host: { $ifNull: ["$referrerHost", null] },
          },
          views: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          referrerType: "$_id.referrerType",
          host: "$_id.host",
          views: 1,
        },
      },
      { $sort: { views: -1 } },
      { $limit: limit },
    ])
    .toArray();
}

export async function aggregateTrafficGeography(start: Date, end: Date, limit = 50) {
  return eventsCollection()
    .aggregate<{ countryCode: string | null; views: number; visitors: number }>([
      { $match: { occurredAt: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: { $ifNull: ["$countryCode", null] },
          views: { $sum: 1 },
          visitors: { $addToSet: "$visitorId" },
        },
      },
      {
        $project: {
          _id: 0,
          countryCode: "$_id",
          views: 1,
          visitors: { $size: "$visitors" },
        },
      },
      { $sort: { views: -1 } },
      { $limit: limit },
    ])
    .toArray();
}
