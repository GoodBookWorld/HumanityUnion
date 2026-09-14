/**
 * RESET 05 / 05A / 05C — generalized PLP semantic-gap evaluation entry.
 * Domain-aware detectors share universal ownership/result semantics.
 */

export {
  evaluateCountryInitiativeRailSemanticGaps,
  evaluateLifecycleStageLabelSemanticGaps,
  evaluateElectionSidebarSemanticGaps,
  assertNoCountryInitiativeRailSemanticGaps,
  type PlpSemanticGapFinding,
  type PlpSemanticGapKind,
  type PlpSemanticGapReport,
} from "./country-initiative-rail-gap";

export {
  evaluateMediaFaqBrandSemanticGaps,
  assertNoMediaFaqBrandSemanticGaps,
} from "./media-faq-brand-gap";

import { evaluateInitiativeLifecycleSemanticClosure } from "@hu/types";

import {
  evaluateCountryInitiativeRailSemanticGaps,
  evaluateLifecycleStageLabelSemanticGaps,
  evaluateElectionSidebarSemanticGaps,
  type PlpSemanticGapFinding,
  type PlpSemanticGapReport,
} from "./country-initiative-rail-gap";
import { evaluateMediaFaqBrandSemanticGaps } from "./media-faq-brand-gap";

/**
 * Combine country-rail HTML gaps, lifecycle inventory closure, and 05A residual classes.
 */
export function evaluateReset05SemanticGaps(input: {
  readonly html?: string;
  readonly locale: string;
  readonly hasSpecificGeographyCodes?: boolean;
  /** When set with html, also run Media FAQ Brand bypass detection (05C). */
  readonly mediaFaqBrandSiteName?: string;
  readonly englishBrandSiteName?: string;
}): PlpSemanticGapReport {
  const findings: PlpSemanticGapFinding[] = [];

  if (input.html) {
    const rail = evaluateCountryInitiativeRailSemanticGaps({
      html: input.html,
      locale: input.locale,
      hasSpecificGeographyCodes: input.hasSpecificGeographyCodes,
    });
    findings.push(...rail.findings);

    const lifecycle = evaluateLifecycleStageLabelSemanticGaps({
      html: input.html,
      locale: input.locale,
    });
    findings.push(...lifecycle.findings);

    const sidebar = evaluateElectionSidebarSemanticGaps({
      html: input.html,
      locale: input.locale,
    });
    findings.push(...sidebar.findings);

    if (input.mediaFaqBrandSiteName) {
      const faqBrand = evaluateMediaFaqBrandSemanticGaps({
        html: input.html,
        locale: input.locale,
        brandSiteName: input.mediaFaqBrandSiteName,
        englishBrandSiteName: input.englishBrandSiteName,
      });
      findings.push(...faqBrand.findings);
    }
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
    pack: "RESET_05A",
    locale: input.locale,
    findings,
    ok: findings.length === 0,
  };
}
