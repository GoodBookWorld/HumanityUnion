import type { Collection, Db, Document } from "mongodb";

import { resolveMongoConfig } from "./mongo-config.js";
import { getMongoClient } from "./mongo-connection.js";

export function getMongoDatabase(): Db {
  const config = resolveMongoConfig();

  return getMongoClient().db(config.database);
}

export function getMongoCollection<TSchema extends Document = Document>(
  collectionName: string,
): Collection<TSchema> {
  return getMongoDatabase().collection<TSchema>(collectionName);
}
