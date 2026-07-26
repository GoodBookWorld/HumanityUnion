import { loadApiEnvironment } from "./load-api-environment.js";
import {
  resolveCorsOrigin,
  validateProductionEnvironment,
} from "./validate-production-environment.js";

loadApiEnvironment();

export const environment = {
  apiPort: Number(process.env.PORT ?? process.env.API_PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  corsOrigin: resolveCorsOrigin() ?? "http://localhost:3000",
  apiPublicUrl:
    process.env.API_PUBLIC_URL?.trim() ??
    `http://localhost:${Number(process.env.PORT ?? process.env.API_PORT ?? 4000)}`,
  platformVersion: process.env.PLATFORM_VERSION?.trim() ?? "0.1.0",
};

export function initializeEnvironment(): void {
  validateProductionEnvironment();
}
