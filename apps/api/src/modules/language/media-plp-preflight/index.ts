/**
 * Reset 03A — Media PLP safety preflight (thin operator surface).
 * Do not re-export through language/index.ts (keeps operator graph thin).
 */

export {
  assertMediaPlpPreflightImportIsolation,
  collectMediaPlpPreflightModuleSources,
  listMediaPlpPreflightModuleFiles,
} from "./import-guards.js";
export {
  getMediaPlpPreflightCounters,
  markMediaPlpPreflightLanguageRegistryLookup,
  markMediaPlpPreflightMongoClosed,
  markMediaPlpPreflightPlpLookup,
  markMediaPlpPreflightProviderCallForTests,
  markMediaPlpPreflightSourceLookup,
  markMediaPlpPreflightWriteForTests,
  resetMediaPlpPreflightCountersForTests,
} from "./counters.js";
export {
  captureMediaPlpPreflightAfterImport,
  captureMediaPlpPreflightAfterMongoConnect,
  captureMediaPlpPreflightAfterPlpLookup,
  captureMediaPlpPreflightAfterSourceLookup,
  captureMediaPlpPreflightStart,
  getMediaPlpPreflightMemoryPhases,
} from "./memory-phases.js";
export {
  parseMediaPlpPreflightArgs,
  type MediaPlpPreflightArgs,
} from "./parse-args.js";
export {
  evaluateMediaPlpPreflightProductionRefusal,
  type MediaPlpPreflightProductionCheck,
} from "./production-refusal.js";
export {
  printMediaPlpPreflightReport,
  runMediaPlpPreflight,
  type MediaPlpPreflightDeps,
  type MediaPlpPreflightReport,
} from "./run-preflight.js";
export {
  loadMediaPlpPreflightSource,
  type MediaPlpPreflightSourceLookup,
} from "./source-lookup.js";
export {
  loadMediaPlpPreflightCurrent,
  type MediaPlpPreflightPlpLookup,
} from "./plp-lookup.js";
export {
  loadMediaPlpPreflightLocale,
  type MediaPlpPreflightLocaleLookup,
} from "./language-registry-lookup.js";
