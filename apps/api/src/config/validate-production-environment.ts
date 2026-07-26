import { resolvePlatformMode } from "./platform.config.js";

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

export function validateProductionEnvironment(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const missing: string[] = REQUIRED_PRODUCTION_VARIABLES.filter((name) => !readEnv(name));

  if (!resolveCorsOrigin()) {
    missing.push("CORS_ORIGIN (or WEB_ORIGIN)");
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required production environment variables: ${missing.join(", ")}. ` +
        "Copy .env.example files and configure secrets before starting the API in production.",
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
  return [...REQUIRED_PRODUCTION_VARIABLES, "CORS_ORIGIN (or WEB_ORIGIN)"];
}
