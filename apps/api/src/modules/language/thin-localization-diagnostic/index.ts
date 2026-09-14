/**
 * Pack 08K.2.8 — thin localization residual diagnostic surface.
 * Do not re-export through language/index.ts (keeps operator graph thin).
 */

export {
  getThinLocalizationImportGuards,
  markFullApplicationGraphImportedForTests,
  markFullCorpusHydratedForTests,
  markPresentationTreeBuiltForTests,
  markProviderModuleImportedForTests,
  markWorkerModuleImportedForTests,
  resetThinLocalizationImportGuardsForTests,
} from "./import-guards.js";
export {
  captureThinLocalizationAfterDbConnect,
  captureThinLocalizationAfterIdentityLookups,
  captureThinLocalizationAfterImports,
  captureThinLocalizationAfterRegistry,
  captureThinLocalizationProcessStart,
  getThinLocalizationMemoryPhases,
} from "./memory-phases.js";
export {
  parseThinResidualIdentityArg,
  parseThinResidualIdentityArgs,
  type ThinResidualIdentity,
} from "./parse-residual-args.js";
export {
  resolveThinResidualState,
  thinResidualDiagnosticDigest,
  type ThinResidualDiagnosticRow,
  type ThinResidualLookupDeps,
} from "./resolve-thin-residual.js";
export {
  printThinLocalizationDiagnosticReport,
  runThinLocalizationResidualDiagnostic,
  type ThinLocalizationDiagnosticReport,
} from "./run-thin-diagnostic.js";
export {
  getThinLocalizationCounters,
  resetThinLocalizationCountersForTests,
} from "./thin-counters.js";
export { THIN_WARM_ATTEMPTS_LIST_LIMIT } from "./mongo-lookups.js";
