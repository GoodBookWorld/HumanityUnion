import type { CivicNominationVotePersistenceAdapter } from "./civic-nomination-vote-persistence.types.js";
import { createMemoryCivicNominationVotePersistenceAdapter } from "./civic-nomination-vote-memory.persistence.js";
import { createMongoCivicNominationVotePersistenceAdapter } from "./civic-nomination-vote-mongo.persistence.js";

export function resolveCivicNominationVotePersistenceAdapter(): CivicNominationVotePersistenceAdapter {
  const mode = process.env.CIVIC_NOMINATION_VOTE_PERSISTENCE ?? "memory";

  switch (mode) {
    case "mongodb":
      return createMongoCivicNominationVotePersistenceAdapter();
    case "memory":
    default:
      return createMemoryCivicNominationVotePersistenceAdapter();
  }
}
