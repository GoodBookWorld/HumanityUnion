import type { TrafficReferrerType } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";

export type TrafficAggregateDimension = "total" | "country" | "referrer" | "meta";

export interface TrafficDailyAggregateDocument {
  aggregateKey: string;
  day: string;
  dimension: TrafficAggregateDimension;
  dimensionKey: string;
  views: number;
  visitors: number;
  sessions: number;
  updatedAt: Date;
  /** Meta-only fields */
  collectionStartedAt?: Date;
  allTimeViews?: number;
  allTimeSessions?: number;
}

export interface TrafficVisitorRegistryDocument {
  visitorId: string;
  firstSeenAt: Date;
  lastSeenDay: string;
  updatedAt: Date;
}

const META_KEY = "__meta__";

function aggregatesCollection() {
  return getMongoCollection<TrafficDailyAggregateDocument>(
    MONGO_COLLECTIONS.trafficDailyAggregates,
  );
}

function visitorRegistryCollection() {
  return getMongoCollection<TrafficVisitorRegistryDocument>(
    MONGO_COLLECTIONS.trafficVisitorRegistry,
  );
}

export function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildTotalAggregateKey(day: string): string {
  return `${day}|total`;
}

export function buildCountryAggregateKey(day: string, countryCode: string | undefined): string {
  return `${day}|country|${countryCode ?? "_unknown"}`;
}

export function buildReferrerAggregateKey(
  day: string,
  referrerType: TrafficReferrerType,
  referrerHost: string | null | undefined,
): string {
  if (referrerType === "EXTERNAL" && referrerHost) {
    return `${day}|referrer|EXTERNAL|${referrerHost}`;
  }
  return `${day}|referrer|${referrerType}`;
}

/**
 * Touch opaque visitor registry. Returns whether this is a new all-time visitor
 * and/or a new visitor for the UTC calendar day (for daily unique increments).
 */
export async function touchTrafficVisitorDay(input: {
  visitorId: string;
  day: string;
  occurredAt: Date;
}): Promise<{ isNewVisitorAllTime: boolean; isNewVisitorDay: boolean }> {
  const existing = await visitorRegistryCollection().findOne({ visitorId: input.visitorId });

  if (!existing) {
    try {
      await visitorRegistryCollection().insertOne({
        visitorId: input.visitorId,
        firstSeenAt: input.occurredAt,
        lastSeenDay: input.day,
        updatedAt: input.occurredAt,
      });
      return { isNewVisitorAllTime: true, isNewVisitorDay: true };
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: number }).code === 11000
      ) {
        const raced = await visitorRegistryCollection().findOne({ visitorId: input.visitorId });
        if (!raced) {
          return { isNewVisitorAllTime: false, isNewVisitorDay: false };
        }
        if (raced.lastSeenDay === input.day) {
          return { isNewVisitorAllTime: false, isNewVisitorDay: false };
        }
        await visitorRegistryCollection().updateOne(
          { visitorId: input.visitorId },
          { $set: { lastSeenDay: input.day, updatedAt: input.occurredAt } },
        );
        return { isNewVisitorAllTime: false, isNewVisitorDay: true };
      }
      throw error;
    }
  }

  if (existing.lastSeenDay === input.day) {
    return { isNewVisitorAllTime: false, isNewVisitorDay: false };
  }

  await visitorRegistryCollection().updateOne(
    { visitorId: input.visitorId },
    { $set: { lastSeenDay: input.day, updatedAt: input.occurredAt } },
  );
  return { isNewVisitorAllTime: false, isNewVisitorDay: true };
}

async function incrementAggregate(input: {
  aggregateKey: string;
  day: string;
  dimension: TrafficAggregateDimension;
  dimensionKey: string;
  views: number;
  visitors: number;
  sessions: number;
  occurredAt: Date;
}): Promise<void> {
  if (input.views === 0 && input.visitors === 0 && input.sessions === 0) {
    return;
  }

  await aggregatesCollection().updateOne(
    { aggregateKey: input.aggregateKey },
    {
      $setOnInsert: {
        aggregateKey: input.aggregateKey,
        day: input.day,
        dimension: input.dimension,
        dimensionKey: input.dimensionKey,
      },
      $inc: {
        views: input.views,
        visitors: input.visitors,
        sessions: input.sessions,
      },
      $set: { updatedAt: input.occurredAt },
    },
    { upsert: true },
  );
}

async function touchAnalyticsMeta(input: {
  occurredAt: Date;
  views: number;
  sessions: number;
}): Promise<void> {
  await aggregatesCollection().updateOne(
    { aggregateKey: META_KEY },
    {
      $setOnInsert: {
        aggregateKey: META_KEY,
        day: META_KEY,
        dimension: "meta",
        dimensionKey: "",
        views: 0,
        visitors: 0,
        sessions: 0,
        collectionStartedAt: input.occurredAt,
      },
      $inc: {
        allTimeViews: input.views,
        allTimeSessions: input.sessions,
      },
      $set: { updatedAt: input.occurredAt },
    },
    { upsert: true },
  );
}

/**
 * After an accepted (non-duplicate) pageview, update long-lived aggregates.
 * Best-effort: callers should not fail navigation if this throws.
 */
export async function recordAcceptedTrafficAggregates(input: {
  visitorId: string;
  occurredAt: Date;
  isNewSession: boolean;
  countryCode?: string;
  referrerType: TrafficReferrerType;
  referrerHost?: string | null;
}): Promise<void> {
  const day = utcDayKey(input.occurredAt);
  const { isNewVisitorDay } = await touchTrafficVisitorDay({
    visitorId: input.visitorId,
    day,
    occurredAt: input.occurredAt,
  });

  const visitorInc = isNewVisitorDay ? 1 : 0;
  const sessionInc = input.isNewSession ? 1 : 0;

  await Promise.all([
    incrementAggregate({
      aggregateKey: buildTotalAggregateKey(day),
      day,
      dimension: "total",
      dimensionKey: "",
      views: 1,
      visitors: visitorInc,
      sessions: sessionInc,
      occurredAt: input.occurredAt,
    }),
    incrementAggregate({
      aggregateKey: buildCountryAggregateKey(day, input.countryCode),
      day,
      dimension: "country",
      dimensionKey: input.countryCode ?? "_unknown",
      views: 1,
      visitors: visitorInc,
      sessions: sessionInc,
      occurredAt: input.occurredAt,
    }),
    incrementAggregate({
      aggregateKey: buildReferrerAggregateKey(day, input.referrerType, input.referrerHost),
      day,
      dimension: "referrer",
      dimensionKey:
        input.referrerType === "EXTERNAL" && input.referrerHost
          ? `EXTERNAL|${input.referrerHost}`
          : input.referrerType,
      views: 1,
      visitors: visitorInc,
      sessions: sessionInc,
      occurredAt: input.occurredAt,
    }),
    touchAnalyticsMeta({
      occurredAt: input.occurredAt,
      views: 1,
      sessions: sessionInc,
    }),
  ]);
}

export async function getTrafficAnalyticsMeta(): Promise<{
  collectionStartedAt: Date | null;
  allTimeViews: number;
  allTimeSessions: number;
} | null> {
  const meta = await aggregatesCollection().findOne({ aggregateKey: META_KEY });
  if (!meta) {
    return null;
  }
  return {
    collectionStartedAt: meta.collectionStartedAt ?? null,
    allTimeViews: meta.allTimeViews ?? 0,
    allTimeSessions: meta.allTimeSessions ?? 0,
  };
}

export async function countAllTimeTrafficVisitors(): Promise<number> {
  return visitorRegistryCollection().countDocuments();
}

export async function listTotalAggregatesBetween(
  startDayInclusive: string,
  endDayInclusive: string,
): Promise<TrafficDailyAggregateDocument[]> {
  return aggregatesCollection()
    .find({
      dimension: "total",
      day: { $gte: startDayInclusive, $lte: endDayInclusive },
    })
    .sort({ day: 1 })
    .toArray();
}

export async function listDimensionAggregatesBetween(
  dimension: "country" | "referrer",
  startDayInclusive: string,
  endDayInclusive: string,
): Promise<TrafficDailyAggregateDocument[]> {
  return aggregatesCollection()
    .find({
      dimension,
      day: { $gte: startDayInclusive, $lte: endDayInclusive },
    })
    .toArray();
}

export async function sumTotalAggregatesBetween(
  startDayInclusive: string,
  endDayInclusive: string,
): Promise<{ views: number; visitors: number; sessions: number }> {
  const [row] = await aggregatesCollection()
    .aggregate<{ views: number; visitors: number; sessions: number }>([
      {
        $match: {
          dimension: "total",
          day: { $gte: startDayInclusive, $lte: endDayInclusive },
        },
      },
      {
        $group: {
          _id: null,
          views: { $sum: "$views" },
          visitors: { $sum: "$visitors" },
          sessions: { $sum: "$sessions" },
        },
      },
    ])
    .toArray();

  return row ?? { views: 0, visitors: 0, sessions: 0 };
}
