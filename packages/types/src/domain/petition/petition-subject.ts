import type { DecisionId } from "../collective-decision/collective-decision.js";
import type { InitiativeId } from "../initiative.js";

export interface PetitionSubject {
  decisionId: DecisionId;
  initiativeId: InitiativeId;
  title: string;
  summary: string;
}
