/**
 * Reset 03B — Media PLP materializer exports (thin operator surface).
 * Do not re-export through language/index.ts.
 */

export {
  MEDIA_PLP_OPERATOR_DEFAULT_MAX_PROVIDER_INPUT_BYTES,
  MEDIA_PLP_OPERATOR_DEFAULT_MAX_RSS_MB,
  MEDIA_PLP_STAGING_DATABASE,
  resolveMediaPlpOperatorMaxProviderInputBytes,
  resolveMediaPlpOperatorMaxRssMb,
} from "./constants.js";
export {
  getMediaPlpMaterializerCounters,
  markMaterializerMongoClosed,
  markMaterializerContentTranslationWriteForTests,
  markMaterializerSourceWriteForTests,
  resetMediaPlpMaterializerCountersForTests,
} from "./counters.js";
export { assertMediaPlpMaterializerImportIsolation } from "./import-guards.js";
export {
  parseMediaPlpMaterializerArgs,
  type MediaPlpMaterializerArgs,
} from "./parse-args.js";
export {
  printMediaPlpMaterializerReport,
  runMediaPlpMaterializer,
  type MediaPlpMaterializerDeps,
  type MediaPlpMaterializerReport,
} from "./run-materializer.js";
export {
  evaluateMediaPlpMaterializerExecuteGuards,
  evaluateMediaPlpMaterializerProductionRefusal,
} from "./staging-guards.js";
