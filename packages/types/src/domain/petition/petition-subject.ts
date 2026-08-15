import type { DecisionId } from "../collective-decision/collective-decision.js";
import type { InitiativeId } from "../initiative.js";

export interface PetitionSubject {
  decisionId: DecisionId;
  initiativeId: InitiativeId;
  title: string;
  summary: string;
  /**
   * Initiative Lifecycle — Part F, Section 3 (Petition Draft Builder).
   * Optional — every Petition created before Part F / outside the
   * Initiative Lifecycle simply has none of these, and the public
   * projection degrades gracefully when they are absent.
   */
  requestStatement?: string;
  expectedOutcome?: string;
  supportingContext?: string;
  keyArguments?: readonly string[];
}
