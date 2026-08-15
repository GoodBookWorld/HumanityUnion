import { resolvePlatformMode } from "./platform.config.js";
import { collectInvalidProductionPersistenceModes } from "./production-persistence-contract.js";

const REQUIRED_PRODUCTION_VARIABLES = [
  "MONGODB_URI",
  "MONGODB_DATABASE",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
] as const;

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function resolveCorsOrigin(): string | undefined {
  return readEnv("CORS_ORIGIN") ?? readEnv("WEB_ORIGIN");
}

function collectInvalidCorsOrigins(): string[] {
  const raw = resolveCorsOrigin();
  if (!raw) {
    return [];
  }

  const invalid: string[] = [];
  for (const part of raw.split(",").map((value) => value.trim()).filter(Boolean)) {
    if (part === "*") {
      invalid.push("CORS_ORIGIN/WEB_ORIGIN must not be '*' when credentialed browser auth is enabled");
    }
  }
  return invalid;
}

export function collectInvalidMediaStorageConfig(): string[] {
  const provider = (readEnv("MEDIA_STORAGE_PROVIDER") ?? "local").toLowerCase();
  const allowEphemeralLocal = readEnv("MEDIA_ALLOW_EPHEMERAL_LOCAL_STORAGE") === "true";

  if (provider === "memory") {
    return ["MEDIA_STORAGE_PROVIDER=memory is not allowed in production"];
  }

  if (provider === "local" && !allowEphemeralLocal) {
    return [
      "MEDIA_STORAGE_PROVIDER=local is not allowed in production without MEDIA_ALLOW_EPHEMERAL_LOCAL_STORAGE=true " +
        "(Render/ephemeral disks lose uploads). Prefer MEDIA_STORAGE_PROVIDER=r2.",
    ];
  }

  if (provider === "r2") {
    const required = [
      "R2_ACCOUNT_ID",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "R2_BUCKET",
      "R2_PUBLIC_BASE_URL",
      "R2_PRIVATE_BUCKET",
    ];
    const missing = required
      .filter((name) => !readEnv(name))
      .map((name) => `${name} is required when MEDIA_STORAGE_PROVIDER=r2`);

    const publicBucket = readEnv("R2_BUCKET");
    const privateBucket = readEnv("R2_PRIVATE_BUCKET");
    if (publicBucket && privateBucket && publicBucket === privateBucket) {
      missing.push(
        "R2_PRIVATE_BUCKET must differ from R2_BUCKET (private Shared Documents must not use the public media bucket/CDN)",
      );
    }

    return missing;
  }

  if (provider !== "local" && provider !== "r2") {
    return [`MEDIA_STORAGE_PROVIDER=${provider} is unsupported (use local|r2)`];
  }

  return [];
}

export function validateProductionEnvironment(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const problems: string[] = [];

  for (const name of REQUIRED_PRODUCTION_VARIABLES) {
    if (!readEnv(name)) {
      problems.push(`Missing ${name}`);
    }
  }

  if (!resolveCorsOrigin()) {
    problems.push("Missing CORS_ORIGIN (or WEB_ORIGIN)");
  }

  problems.push(...collectInvalidCorsOrigins());
  problems.push(...collectInvalidProductionPersistenceModes().map((item) => `Invalid persistence ${item}`));
  problems.push(...collectInvalidMediaStorageConfig());

  if (problems.length > 0) {
    throw new Error(
      `Invalid production configuration:\n- ${problems.join("\n- ")}\n` +
        "See project/architecture/operations/PRODUCTION_CONFIGURATION_OPERATIONS_v1.0.md",
    );
  }

  if (readEnv("AUTH_BOOTSTRAP_FALLBACK") === "true") {
    console.warn(
      "WARNING: AUTH_BOOTSTRAP_FALLBACK=true in production. Disable bootstrap auth fallback before public beta.",
    );
  }

  const explicitPlatformMode = readEnv("PLATFORM_MODE");

  if (explicitPlatformMode === "development") {
    throw new Error("PLATFORM_MODE=development is not allowed when NODE_ENV=production.");
  }

  const platformMode = resolvePlatformMode();

  if (platformMode === "beta" || platformMode === "production") {
    if (readEnv("AUTH_BOOTSTRAP_FALLBACK") === "true") {
      throw new Error(
        "AUTH_BOOTSTRAP_FALLBACK must be false when PLATFORM_MODE is beta or production.",
      );
    }
  }
}

export function listRequiredProductionVariables(): readonly string[] {
  return [
    ...REQUIRED_PRODUCTION_VARIABLES,
    "CORS_ORIGIN (or WEB_ORIGIN)",
    "MEDIA_STORAGE_PROVIDER=r2 (or local + MEDIA_ALLOW_EPHEMERAL_LOCAL_STORAGE=true)",
  ];
}
