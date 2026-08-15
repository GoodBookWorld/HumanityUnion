import { MongoClient, type MongoClientOptions } from "mongodb";

import { assertMongoConfigured, resolveMongoConfig } from "./mongo-config.js";

let client: MongoClient | null = null;
let connectPromise: Promise<MongoClient> | null = null;

export async function connectMongoClient(): Promise<MongoClient> {
  if (client) {
    return client;
  }

  if (connectPromise) {
    return connectPromise;
  }

  const config = resolveMongoConfig();
  const uri = assertMongoConfigured();

  const options: MongoClientOptions = {
    connectTimeoutMS: config.connectTimeoutMs,
    serverSelectionTimeoutMS: config.serverSelectionTimeoutMs,
    maxPoolSize: config.maxPoolSize,
  };

  connectPromise = MongoClient.connect(uri, options)
    .then((connectedClient) => {
      client = connectedClient;
      return connectedClient;
    })
    .catch((error) => {
      // Launch Readiness Pack 06 — allow a later retry after a failed connect
      // instead of permanently sticky-rejecting for the process lifetime.
      connectPromise = null;
      throw error;
    });

  return connectPromise;
}

export async function disconnectMongoClient(): Promise<void> {
  const pendingConnect = connectPromise;
  connectPromise = null;

  if (pendingConnect && !client) {
    try {
      const connectedClient = await pendingConnect;
      await connectedClient.close();
    } catch {
      // Ignore connect/close races during verification teardown.
    }
  }

  if (!client) {
    return;
  }

  await client.close();
  client = null;
  connectPromise = null;
}

export function getMongoClient(): MongoClient {
  if (!client) {
    throw new Error("MongoDB client is not connected. Call connectMongoClient() first.");
  }

  return client;
}
