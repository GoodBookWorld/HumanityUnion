export {
  PRODUCTION_AUTH_ACTIVATION_CONFIRM_FLAG,
  PRODUCTION_AUTH_ACTIVATION_CONFIRM_VALUE,
  PRODUCTION_AUTH_ACTIVATION_TARGET_DATABASE,
  PRODUCTION_AUTH_ACTIVATION_USER_IDS_ENV,
  isTestIsolationDatabase,
} from "./constants.js";

export { ProductionAuthActivationError } from "./errors.js";

export {
  resolveProductionAuthActivationAllowlist,
} from "./allowlist.js";
export type { ActivationAllowlistEntry } from "./allowlist.js";

export {
  isProductionAuthActivationExecuteRequested,
  resolveProductionAuthActivationMode,
  runProductionAuthActivation,
} from "./execute.js";
export type {
  ActivationAccountPlanRow,
  ProductionAuthActivationReport,
  RunProductionAuthActivationInput,
} from "./execute.js";

export { assertNoSecretLeak } from "./redact.js";
