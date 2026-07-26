import { isMongoConfigured } from "./mongo-config.js";

export const INITIATIVE_COMMENT_PERSISTENCE_KEY = "INITIATIVE_COMMENT_PERSISTENCE";
export const INITIATIVE_COMMENT_REACTION_PERSISTENCE_KEY =
  "INITIATIVE_COMMENT_REACTION_PERSISTENCE";
export const INITIATIVE_SUPPORT_PERSISTENCE_KEY = "INITIATIVE_SUPPORT_PERSISTENCE";

export type EngagementPersistenceMode = "memory" | "mongodb";

export function resolveEngagementPersistenceMode(envKey: string): EngagementPersistenceMode {
  const explicit = process.env[envKey];

  if (explicit === "mongodb" || explicit === "memory") {
    return explicit;
  }

  return isMongoConfigured() ? "mongodb" : "memory";
}

export function isEngagementMongoMode(envKey: string): boolean {
  return resolveEngagementPersistenceMode(envKey) === "mongodb";
}
