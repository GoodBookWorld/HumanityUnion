import type { ClientSession } from "mongodb";

import { connectMongoClient, getMongoClient } from "../mongodb/mongo-connection.js";
import { isMongoConfigured } from "../mongodb/mongo-config.js";

export class MongoTransactionUnavailableError extends Error {
  readonly code = "MONGO_TRANSACTION_UNAVAILABLE";

  constructor(message = "MongoDB transactions are unavailable.") {
    super(message);
    this.name = "MongoTransactionUnavailableError";
  }
}

export async function runMongoTransaction<T>(
  callback: (session: ClientSession) => Promise<T>,
): Promise<T> {
  if (!isMongoConfigured()) {
    throw new MongoTransactionUnavailableError();
  }

  await connectMongoClient();
  const client = getMongoClient();
  const session = client.startSession();

  try {
    let result: T | undefined;

    await session.withTransaction(async () => {
      result = await callback(session);
    });

    if (result === undefined) {
      throw new Error("Mongo transaction completed without returning a result.");
    }

    return result;
  } finally {
    await session.endSession();
  }
}
