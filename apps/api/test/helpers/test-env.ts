import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(scriptDir, "../..");

dotenv.config({ path: path.join(apiRoot, "../../.env") });
dotenv.config({ path: path.join(apiRoot, ".env") });

export const API_ROOT = apiRoot;

export function isMongoAvailableForTests(): boolean {
  return Boolean(process.env.MONGODB_URI?.trim());
}

export function skipIfMongoUnavailable(): void {
  if (!isMongoAvailableForTests()) {
    console.log("SKIP: MONGODB_URI is not configured.");
    process.exit(0);
  }
}

export function createTestId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}
