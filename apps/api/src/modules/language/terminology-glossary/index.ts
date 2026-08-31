export type { TerminologyGlossarySeedResult } from "./terminology-glossary.repository.js";
export {
  ensureTerminologyGlossarySeeded,
  getTerminologyConceptById,
  getSeededTerminologyConceptDefinition,
  listTerminologyConcepts,
  resetTerminologyGlossaryStoreForTests,
  setTerminologyGlossaryForceMemoryForTests,
  updateTerminologyConcept,
} from "./terminology-glossary.repository.js";
export {
  TERMINOLOGY_GLOSSARY_SEED_DEFINITIONS,
  buildEnglishProviderTerminologyContext,
  buildTerminologyConceptFromSeed,
  isSeededTerminologyConceptId,
  listSeededTerminologyConceptIds,
} from "./terminology-glossary.seed.js";
export {
  TerminologyGlossaryConflictError,
  TerminologyGlossaryError,
  TerminologyGlossaryNotFoundError,
  TerminologyGlossaryPersistenceError,
  TerminologyGlossaryValidationError,
} from "./terminology-glossary.errors.js";
export {
  assertGlossaryAliasIntegrity,
  normalizeGlossaryAliasList,
  normalizeGlossaryTerm,
  normalizeLocaleTranslation,
  sortTerminologyConcepts,
} from "./terminology-glossary.integrity.js";
export { canonicalizeGlossaryTranslationLocales } from "./terminology-glossary.locale.js";
export {
  buildProviderTerminologyContext,
  formatProviderTerminologyContext,
  listPublishedProviderTerminologyLines,
  resolveProviderTerminologyContext,
} from "./terminology-glossary.provider-context.js";
export type { ProviderTerminologyConceptLine } from "./terminology-glossary.provider-context.js";
export {
  getAdminTerminologyConcept,
  listAdminTerminologyConcepts,
  setTerminologyGlossaryAdminAssertOverrideForTests,
  updateAdminTerminologyConcept,
} from "./admin-terminology-glossary.service.js";
export { default as adminTerminologyGlossaryRouter } from "./admin-terminology-glossary.routes.js";
