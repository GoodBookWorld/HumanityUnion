/**
 * Fail-closed switch for the temporary Georgian residual diagnostic.
 * Set only by that script. Normal API startup leaves it unset.
 */

export const HU_READ_ONLY_DIAGNOSTIC_ENV = "HU_READ_ONLY_DIAGNOSTIC";

export function isHuReadOnlyDiagnosticProcess(): boolean {
  return process.env[HU_READ_ONLY_DIAGNOSTIC_ENV] === "1";
}

export function refuseReadOnlyDiagnosticMutation(action: string): void {
  if (isHuReadOnlyDiagnosticProcess()) {
    throw new Error(`REFUSED: read-only diagnostic cannot ${action}.`);
  }
}
