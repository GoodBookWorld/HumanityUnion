/**
 * Reset 03E.8 — API composition-root for Published Localized Presentation persistence.
 *
 * Thin: only the PLP facade + mongo-config. Does NOT import language registry,
 * provider stacks, materializer operators, workers, or warm/reconcile graphs.
 */

import {
  bootstrapPublishedLocalizationApiPersistence,
  getPublishedLocalizationPersistenceProbeMode,
  type PublishedLocalizationPersistenceRuntimeClass,
} from "../../modules/language/published-localized-presentation/persistence/repository.js";

export async function bootstrapPublishedLocalizationPersistence(): Promise<{
  readonly runtimeClass: PublishedLocalizationPersistenceRuntimeClass;
  readonly probeMode: "MONGO" | "MEMORY_TEST" | "UNAVAILABLE";
}> {
  const { runtimeClass } = bootstrapPublishedLocalizationApiPersistence();
  return {
    runtimeClass,
    probeMode: getPublishedLocalizationPersistenceProbeMode(),
  };
}
