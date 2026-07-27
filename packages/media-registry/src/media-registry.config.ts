export interface MediaRegistryRuntimeConfig {
  defaultLanguage: string;
  minReliabilityScore: number;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export function resolveMediaRegistryConfig(): MediaRegistryRuntimeConfig {
  return {
    defaultLanguage: (process.env.MEDIA_REGISTRY_DEFAULT_LANGUAGE ?? "en").trim().toLowerCase(),
    minReliabilityScore: parsePositiveInt(process.env.MEDIA_REGISTRY_MIN_RELIABILITY, 80),
  };
}
