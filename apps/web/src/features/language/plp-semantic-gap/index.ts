/**
 * RESET 05 — generalized PLP semantic-gap evaluation entry.
 * Domain-aware detectors share universal ownership/result semantics.
 */

export {
  evaluateCountryInitiativeRailSemanticGaps,
  assertNoCountryInitiativeRailSemanticGaps,
  type PlpSemanticGapFinding,
  type PlpSemanticGapKind,
  type PlpSemanticGapReport,
} from "./country-initiative-rail-gap";

import { evaluateInitiativeLifecycleSemanticClosure } from "@hu/types";

import {
  evaluateCountryInitiativeRailSemanticGaps,
  type PlpSemanticGapFinding,
  type PlpSemanticGapReport,
} from "./country-initiative-rail-gap";

/**
 * Combine country-rail HTML gaps with lifecycle inventory closure.
 * Intentionally broken rail meta fixtures fail acceptance.
 */
export function evaluateReset05SemanticGaps(input: {
  readonly html?: string;
  readonly locale: string;
}): PlpSemanticGapReport {
  const findings: PlpSemanticGapFinding[] = [];

  if (input.html) {
    const rail = evaluateCountryInitiativeRailSemanticGaps({
      html: input.html,
      locale: input.locale,
    });
    findings.push(...rail.findings);
  }

  const closure = evaluateInitiativeLifecycleSemanticClosure();
  for (const stage of closure.missingStages) {
    findings.push({
      kind: "MISSING_SEMANTIC_NODE",
      surface: `lifecycle:${stage}`,
      detail: "required lifecycle stage missing from PLP inventory",
    });
  }
  for (const path of closure.unownedMachineRows) {
    findings.push({
      kind: "UNOWNED_META",
      surface: `lifecycle:${path}`,
      detail: "MACHINE_CONTENT row lacks migration ownership status",
    });
  }

  return {
    pack: "RESET_05",
    locale: input.locale,
    findings,
    ok: findings.length === 0,
  };
}
