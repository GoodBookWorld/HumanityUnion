import { loadApiEnvironment } from "./load-api-environment.js";
import {
  resolveCorsOrigin,
  validateProductionEnvironment,
} from "./validate-production-environment.js";

loadApiEnvironment();

function resolvePrimaryConfiguredOrigin(): string {
  const raw = resolveCorsOrigin();
  if (!raw) {
    return "http://localhost:3000";
  }

  const first = raw
    .split(",")
    .map((part) => part.trim())
    .find((part) => part.length > 0);

  return first ?? "http://localhost:3000";
}

export const environment = {
  apiPort: Number(process.env.PORT ?? process.env.API_PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  /**
   * Primary configured Web origin (first CORS_ORIGIN / WEB_ORIGIN entry).
   * Prefer `isAllowedWebOrigin` / `resolveCorsOriginOption` for credentialed checks.
   */
  corsOrigin: resolvePrimaryConfiguredOrigin(),
  apiPublicUrl:
    process.env.API_PUBLIC_URL?.trim() ??
    `http://localhost:${Number(process.env.PORT ?? process.env.API_PORT ?? 4000)}`,
  platformVersion: process.env.PLATFORM_VERSION?.trim() ?? "0.1.0",
};

export function initializeEnvironment(): void {
  validateProductionEnvironment();
}
