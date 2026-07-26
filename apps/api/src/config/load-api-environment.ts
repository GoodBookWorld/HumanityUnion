import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const configDir = path.dirname(fileURLToPath(import.meta.url));
export const API_ROOT = path.resolve(configDir, "../..");

let loaded = false;

/**
 * Loads apps/api/.env before any module reads email or auth configuration.
 *
 * Precedence (development / non-production):
 * - Values from apps/api/.env override inherited shell variables so local SMTP
 *   settings are not silently replaced by EMAIL_PROVIDER=mock from a parent shell.
 *
 * Precedence (production):
 * - Existing process environment wins; apps/api/.env fills only unset variables.
 */
export function loadApiEnvironment(): void {
  if (loaded) {
    return;
  }

  const apiEnvPath = path.join(API_ROOT, ".env");
  const monorepoEnvPath = path.join(API_ROOT, "../../.env");
  const overrideApiEnv =
    process.env.NODE_ENV !== "production" &&
    process.env.HU_VERIFICATION_MODE !== "true" &&
    process.env.NODE_TEST_ENV !== "true";

  dotenv.config({ path: monorepoEnvPath });
  dotenv.config({ path: apiEnvPath, override: overrideApiEnv });

  loaded = true;
}
