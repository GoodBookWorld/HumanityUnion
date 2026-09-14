/**
 * Pack 08K.2.4 — residual-diagnostic Mongo bootstrap.
 *
 * Connect + indexes + Language Registry only.
 * NEVER hydrates Initiative / CA / CD (or any civic) snapshot Maps.
 */

import { shouldBootstrapMongoPersistence } from "../../config/production-persistence-contract.js";
import { ensureLanguageRegistrySeeded } from "../../modules/language/language-registry/index.js";
import { assertMongoConfigured } from "../mongodb/mongo-config.js";
import { connectMongoClient } from "../mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../mongodb/mongo-indexes.js";

export type ResidualDiagnosticBootstrapMode =
  | "residual_diagnostic_no_hydrate"
  | "skipped";

/**
 * Minimal persistence for residual-only diagnostics.
 * FULL_CORPUS_HYDRATED remains false by construction.
 */
export async function bootstrapContentTranslationResidualDiagnosticPersistence(): Promise<{
  readonly mode: ResidualDiagnosticBootstrapMode;
  readonly FULL_CORPUS_HYDRATED: false;
}> {
  if (!shouldBootstrapMongoPersistence()) {
    return { mode: "skipped", FULL_CORPUS_HYDRATED: false };
  }

  assertMongoConfigured();
  await connectMongoClient();
  await ensureMongoIndexes();
  await ensureLanguageRegistrySeeded();

  return { mode: "residual_diagnostic_no_hydrate", FULL_CORPUS_HYDRATED: false };
}
