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

  connectPromise = MongoClient.connect(uri, options).then((connectedClient) => {
    client = connectedClient;
    return connectedClient;
  });

  return connectPromise;
}

export async function disconnectMongoClient(): Promise<void> {
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
