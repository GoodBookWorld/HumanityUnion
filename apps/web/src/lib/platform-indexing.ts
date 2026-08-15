/**
 * Staging must never be indexable. Production remains indexable.
 * Driven by NEXT_PUBLIC_PLATFORM_MODE (or NODE_ENV fallback for tooling).
 */
export type PlatformIndexingMode = "production" | "staging" | "development" | "beta" | "other";

type IndexingEnv = {
  NEXT_PUBLIC_PLATFORM_MODE?: string;
  PLATFORM_MODE?: string;
  NODE_ENV?: string;
};

export function resolvePlatformIndexingMode(
  env: IndexingEnv = process.env,
): PlatformIndexingMode {
  const raw = (env.NEXT_PUBLIC_PLATFORM_MODE ?? env.PLATFORM_MODE ?? "").trim().toLowerCase();

  if (raw === "production" || raw === "prod") {
    return "production";
  }
  if (raw === "staging" || raw === "stage") {
    return "staging";
  }
  if (raw === "development" || raw === "dev") {
    return "development";
  }
  if (raw === "beta") {
    return "beta";
  }

  if (env.NODE_ENV === "production" && !raw) {
    return "production";
  }

  return raw ? "other" : "development";
}

export function shouldDisallowSearchIndexing(env: IndexingEnv = process.env): boolean {
  const mode = resolvePlatformIndexingMode(env);
  return mode === "staging" || mode === "development" || mode === "other";
}
