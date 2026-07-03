import type { Petition } from "@hu/types";

import {
  BOOTSTRAP_TIMESTAMP,
  bootstrapCollectiveDecisionId,
  bootstrapInitiativeId,
  bootstrapPetitionId,
  defaultPetitionPolicy,
} from "./petition.defaults.js";
import { createEmptySupportMetrics } from "./petition.helpers.js";

export const bootstrapPetition: Petition = {
  petitionId: bootstrapPetitionId,
  collectiveDecisionId: bootstrapCollectiveDecisionId,
  status: "Open",
  createdAt: BOOTSTRAP_TIMESTAMP,
  updatedAt: BOOTSTRAP_TIMESTAMP,
  subject: {
    decisionId: bootstrapCollectiveDecisionId,
    initiativeId: bootstrapInitiativeId,
    title: "Community Garden Initiative",
    summary:
      "Establish a shared community garden to improve local food access and neighborhood cooperation.",
  },
  policy: {
    ...structuredClone(defaultPetitionPolicy),
    endorsementPeriod: {
      opensAt: BOOTSTRAP_TIMESTAMP,
      closesAt: null,
    },
  },
  shareLink: {
    url: `/petitions/public/${bootstrapPetitionId}`,
    createdAt: BOOTSTRAP_TIMESTAMP,
  },
  signatures: [],
  supportMetrics: createEmptySupportMetrics(),
  outcome: null,
};
