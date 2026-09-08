/**
 * Reset 03B / 03B.2 — Media PLP materializer exports (thin operator surface).
 * Do not re-export through language/index.ts.
 */

export {
  MEDIA_PLP_OPERATOR_DEFAULT_MAX_PROVIDER_INPUT_BYTES,
  MEDIA_PLP_OPERATOR_DEFAULT_MAX_RSS_MB,
  MEDIA_PLP_OPERATOR_DEFAULT_PRE_PROVIDER_MAX_RSS_MB,
  MEDIA_PLP_STAGING_DATABASE,
  resolveMediaPlpOperatorMaxProviderInputBytes,
  resolveMediaPlpOperatorMaxRssMb,
  resolveMediaPlpOperatorPreProviderMaxRssMb,
} from "./constants.js";
export {
  getMediaPlpMaterializerCounters,
  markMaterializerMongoClosed,
  markMaterializerContentTranslationWriteForTests,
  markMaterializerSourceWriteForTests,
  resetMediaPlpMaterializerCountersForTests,
  resetMediaPlpMaterializerProviderCallBudget,
} from "./counters.js";
export {
  assertMediaPlpMaterializerImportIsolation,
  assertThinMediaPlpProviderImportGraph,
} from "./import-guards.js";
export {
  parseMediaPlpMaterializerArgs,
  type MediaPlpMaterializerArgs,
} from "./parse-args.js";
export {
  getMediaPlpPersistenceObservability,
  requireMediaPlpMaterializerMongoPersistence,
} from "./persistence-selection.js";
export type { MediaPlpPersistenceObservability } from "./persistence-selection.js";
export { verifyDurableMediaPlpCurrent } from "./durability-verify.js";
export {
  MEDIA_PLP_STAGING_FORENSIC_PLAN_STATUS,
  MEDIA_PLP_STAGING_FORENSIC_TARGET,
} from "./staging-forensic-read-plan.js";
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
export {
  MEDIA_PLP_PROVIDER_EXECUTION_BOUNDARY,
  importMediaPlpMaterializerProvider,
  callMediaPlpMaterializerProviderOnce,
  validateMediaPlpProviderLocalizationValues,
  flattenStructuredLocalizationValues,
  buildProviderMachinePathDiagnostics,
  formatProviderPathDiagnosticsSafe,
  formatProviderForensicsSafe,
  classifyBrandPathForensics,
  classifyNewsPathForensics,
  deriveProviderPartialSubreason,
  isProviderPartialSubtypeRetryable,
} from "./provider-boundary.js";
export {
  MEDIA_PLP_THIN_GEMINI_TRANSPORT_ID,
  MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
  MEDIA_PLP_DETERMINISTIC_TRANSPORT_ID,
  ThinGeminiMediaPlpTransport,
  FakeLocalMediaPlpTransport,
  createThinMediaPlpProviderFromConfig,
} from "./thin-gemini-transport.js";
export {
  PLP_PROVIDER_FAILURE_SUBTYPE,
  PLP_GEMINI_TRANSLATIONS_RESPONSE_SCHEMA,
  PLP_PROVIDER_CONTRACT_RECOVERY_GENERATION,
  encodePlpTranslationsContract,
  decodePlpTranslationsContract,
  planPlpProviderBatches,
  extractJsonObjectText,
  isPlpProviderFailureSubtypeRetryable,
  isProviderResponseClassFailureReason,
  classifyProviderResponseRecoveryFailure,
  classifyConsumerProviderRecoveryEligibility,
  classifyFinishReasonSubtype,
  classifyHttpTransportErrorClass,
  classifyNetworkTransportErrorClass,
  parseRetryAfterSeconds,
  sanitizeGeminiErrorToken,
  httpStatusClass,
} from "./provider-response-contract.js";
export {
  PLP_PROVIDER_QUOTA_CLASS,
  extractGeminiQuotaForensics,
  parseGeminiRetryDelaySeconds,
  resolveQuotaCooldownSeconds,
  sanitizeQuotaIdentifier,
  isQuotaExhaustionTransport,
} from "./gemini-quota-forensics.js";
export {
  THIN_GEMINI_PROVIDER_STATE_ID,
  activateThinGeminiProviderCooldown,
  clearThinGeminiProviderCooldown,
  getThinGeminiCooldownSnapshot,
  readThinGeminiProviderState,
  resetThinGeminiProviderStateForTests,
  setThinGeminiProviderStateForceMemoryForTests,
} from "./thin-gemini-provider-state.js";
export {
  withThinGeminiGovernor,
  resolveThinGeminiMinSpacingMs,
  resetThinGeminiGovernorForTests,
  getThinGeminiGovernorInFlightForTests,
  getThinGeminiGovernorPeakConcurrencyForTests,
} from "./thin-gemini-governor.js";
