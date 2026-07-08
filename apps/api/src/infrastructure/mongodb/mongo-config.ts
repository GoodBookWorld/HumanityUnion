export interface MongoConfig {
  uri: string | null;
  database: string;
  connectTimeoutMs: number;
  serverSelectionTimeoutMs: number;
  maxPoolSize: number;
}

export function resolveMongoConfig(): MongoConfig {
  const uri = process.env.MONGODB_URI?.trim() || null;

  return {
    uri,
    database: process.env.MONGODB_DATABASE?.trim() || "humanity_union",
    connectTimeoutMs: Number(process.env.MONGODB_CONNECT_TIMEOUT_MS ?? 10_000),
    serverSelectionTimeoutMs: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS ?? 10_000),
    maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE ?? 10),
  };
}

export function isMongoConfigured(): boolean {
  return Boolean(resolveMongoConfig().uri);
}

export function assertMongoConfigured(): string {
  const uri = resolveMongoConfig().uri;

  if (!uri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  return uri;
}
