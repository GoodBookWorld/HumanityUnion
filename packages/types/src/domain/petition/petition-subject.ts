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
  /**
   * HU-LC-05C.4C — intended recipients copied from the published working draft
   * (free text, Author-provided). Optional; absent on every earlier Petition.
   */
  recipients?: readonly string[];
}
