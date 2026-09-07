/**
 * RESET 05B — Initiative PLP thin diagnose/materialize operator.
 */

export {
  INITIATIVE_PLP_STAGING_DATABASE,
  INITIATIVE_PLP_PROVIDER_EXECUTION_BOUNDARY,
  INITIATIVE_PLP_FAKE_LOCAL_TRANSPORT_ID,
} from "./constants.js";
export {
  parseInitiativePlpOperatorArgs,
  type InitiativePlpOperatorArgs,
} from "./parse-args.js";
export {
  buildInitiativePlpCardFromThinDoc,
  buildInitiativePlpContractFromCard,
  resolveInitiativePlpOperatorSource,
} from "./source-resolve.js";
export {
  inventoryInitiativePlpSemanticNodes,
  assertInitiativeMachineNodesExcludeNonMachine,
} from "./inventory.js";
export {
  runInitiativePlpDiagnose,
  printInitiativePlpDiagnoseReport,
} from "./run-diagnose.js";
export {
  runInitiativePlpMaterialize,
  printInitiativePlpMaterializeReport,
} from "./run-materialize.js";
export {
  resetInitiativePlpOperatorCountersForTests,
  getInitiativePlpOperatorCounters,
} from "./counters.js";
export {
  evaluateInitiativePlpExecuteGuards,
  evaluateInitiativePlpProductionRefusal,
} from "./staging-guards.js";
export { runInitiativePlpFakeLocalProvider } from "./provider-boundary.js";
