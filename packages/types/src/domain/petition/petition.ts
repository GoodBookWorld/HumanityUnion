import type { DecisionId } from "../collective-decision/collective-decision.js";
import type { PetitionTraceability } from "../initiative-petition-lifecycle.js";
import type { PetitionOutcome } from "./petition-outcome.js";
import type { PetitionPolicy } from "./petition-policy.js";
import type { PetitionState } from "./petition-state.js";
import type { PetitionSubject } from "./petition-subject.js";
import type { ShareLink } from "./share-link.js";
import type { Signature } from "./signature.js";
import type { SupportMetrics } from "./support-metrics.js";

export type PetitionId = string;

export interface Petition {
  petitionId: PetitionId;
  collectiveDecisionId: DecisionId;
  status: PetitionState;
  createdAt: string;
  updatedAt: string;
  subject: PetitionSubject;
  policy: PetitionPolicy;
  shareLink: ShareLink | null;
  signatures: Signature[];
  supportMetrics: SupportMetrics;
  outcome: PetitionOutcome | null;
  /**
   * Initiative Lifecycle — Part F, Section 9 (Traceability). Optional so
   * every Petition created before Part F (or via the legacy Collective
   * Decision path, which never resolves an Initiative Lifecycle Revision)
   * deserializes cleanly with `null`/`undefined`. Set once, at creation
   * time, from the Initiative Lifecycle "Petition" stage — never mutated
   * afterward.
   */
  traceability?: PetitionTraceability | null;
}
