export { assessWebUiCatalogReadinessForLocale } from "./assess-web-ui-catalog-readiness.js";
export { assessControlledVocabularyReadinessForLocale } from "./assess-controlled-vocabulary-readiness.js";
export {
  planLanguageHistoricalBackfill,
  aggregateCtCountsFromPlan,
  aggregatePlpCountsFromPlan,
} from "./language-historical-backfill-planner.js";
export type { LanguageHistoricalBackfillPlannerDeps } from "./language-historical-backfill-planner.js";
export { evaluateLanguageLocalizationReadiness } from "./language-localization-readiness-evaluator.js";
export type { EvaluateLanguageLocalizationReadinessInput } from "./language-localization-readiness-evaluator.js";
export {
  measureBoundedPwaCivicCoverage,
  setBoundedPwaCivicCoverageDepsForTests,
  buildPwaCivicBoundedMeasurePlans,
  buildPresentationIdentityCountPipeline,
  buildImprovementProposalIdentityCountPipeline,
  PWA_CIVIC_BOUNDED_CT_KINDS,
  PWA_CIVIC_IMPROVEMENT_PROPOSAL_PUBLIC_STATUSES,
} from "./bounded-pwa-civic-coverage.js";
export type {
  BoundedPwaCivicCoverageDeps,
  BoundedPwaCivicCoverageReport,
} from "./bounded-pwa-civic-coverage.js";
export { activateLanguageLocalization } from "./language-activation-orchestrator.js";
export type {
  ActivateLanguageLocalizationInput,
  LanguageActivationResult,
} from "./language-activation-orchestrator.js";
export {
  assertNoHardcodedLocaleEligibilityPolicy,
  findHardcodedLocaleEligibilityPolicy,
} from "./assert-no-hardcoded-locale-eligibility.js";
export {
  getLanguageActivationAdminView,
  processLanguageActivationJob,
  resetLanguageActivationJobSchedulerForTests,
  resumeIncompleteWebUiActivationJobsOnBoot,
  scheduleLanguageActivationJobProcess,
  scheduleWebUiActivationTick,
  scheduleWebUiActivationTickAt,
  setLanguageActivationJobAdminAssertOverrideForTests,
  setLanguageActivationJobProcessDepsForTests,
  startAndProcessLanguageActivationJobForTests,
  startOrResumeLanguageActivationJob,
} from "./language-activation-job.service.js";
export type { LanguageActivationJobProcessDeps } from "./language-activation-job.service.js";
export {
  buildWebUiDomainProgress,
  deriveActivationJobStatus,
  emptyPendingDomains,
  isLanguageActivationWebUiReadyForHistoricalEnqueue,
  terminologyDomainFromPreparationResult,
  terminologyDomainProviderConfigFailure,
} from "./language-activation-job.domains.js";
export {
  aggregateTerminologyFailureDiagnostics,
  classifyTerminologyActivationFailureReason,
  formatTerminologyProviderDiagnosticSummary,
  sanitizeTerminologyProviderDiagnostic,
  terminologyProviderDiagnosticFromReason,
} from "./terminology-activation-failure-diagnostic.js";
export {
  resetLanguageActivationJobStoreForTests,
  setLanguageActivationJobForceMemoryForTests,
} from "./language-activation-job.repository.js";
export {
  LanguageActivationJobError,
  LanguageActivationJobNotFoundError,
  LanguageActivationJobPersistenceError,
  LanguageActivationJobValidationError,
} from "./language-activation-job.errors.js";
