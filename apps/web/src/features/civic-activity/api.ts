import type { Initiative } from "@hu/types";

import { listMyDecisionSessions } from "../decision-session/api";
import { listMyInitiativeAnalyses } from "../initiative-collaborative-analysis/api";
import {
  getMyInitiativeDecisionVote,
  listPublicInitiativeCollectiveDecisions,
} from "../initiative-collective-decision/api";
import { listMyImprovementProposals } from "../initiative-improvement-proposal/api";
import { listMyInitiatives } from "../initiatives/api";

import {
  buildCivicActivitySnapshot,
  createEmptyCivicActivitySnapshot,
} from "./lib/aggregate-civic-activity";
import type { CivicActivitySnapshot, MyDecisionVoteRecord } from "./types";

async function loadMyDecisionVotes(initiatives: Initiative[]): Promise<MyDecisionVoteRecord[]> {
  const votes: MyDecisionVoteRecord[] = [];

  for (const initiative of initiatives) {
    let decisions;

    try {
      const response = await listPublicInitiativeCollectiveDecisions(initiative.initiativeId);
      decisions = response.decisions;
    } catch {
      continue;
    }

    for (const decision of decisions) {
      try {
        const vote = await getMyInitiativeDecisionVote(decision.decisionId);

        if (vote) {
          votes.push({
            vote,
            decisionQuestion: decision.question,
            initiativeId: initiative.initiativeId,
          });
        }
      } catch {
        continue;
      }
    }
  }

  return votes;
}

export async function loadCivicActivitySnapshot(): Promise<CivicActivitySnapshot> {
  try {
    const [initiatives, analyses, proposals, decisionSessions] = await Promise.all([
      listMyInitiatives(),
      listMyInitiativeAnalyses(),
      listMyImprovementProposals(),
      listMyDecisionSessions(),
    ]);
    const votes = await loadMyDecisionVotes(initiatives);

    return buildCivicActivitySnapshot({
      initiatives,
      analyses,
      proposals,
      decisionSessions,
      votes,
    });
  } catch {
    return createEmptyCivicActivitySnapshot();
  }
}
