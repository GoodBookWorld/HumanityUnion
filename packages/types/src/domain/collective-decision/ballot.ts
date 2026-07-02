import type { DecisionOption } from "./decision-option.js";
import type { DecisionRules } from "./decision-rules.js";
import type { EligibilityRules } from "./eligibility-rules.js";

export type BallotId = string;

export interface Ballot {
  ballotId: BallotId;
  question: string;
  options: DecisionOption[];
  decisionRules: DecisionRules;
  eligibilityRules: EligibilityRules;
  opensAt: string;
  closesAt: string;
}
