import { Router } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { getInitiativeSupportStatistics } from "../initiative-support/initiative-support.service.js";
import { listInitiatives } from "./initiative.store.js";
import {
  listWorldInitiativeCardProjections,
  WORLD_INITIATIVES_DEFAULT_LIMIT,
} from "./initiative-world-initiatives.projection.js";

const publicWorldInitiativesRouter = Router();

publicWorldInitiativesRouter.get("/world-initiatives", async (req, res) => {
  const parsedLimit = Number.parseInt(
    String(req.query.limit ?? WORLD_INITIATIVES_DEFAULT_LIMIT),
    10,
  );
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : WORLD_INITIATIVES_DEFAULT_LIMIT;

  const initiatives = await Promise.all(
    listWorldInitiativeCardProjections(listInitiatives(), limit).map(async (card) => {
      const stats = await getInitiativeSupportStatistics({ initiativeId: card.initiativeId });
      return {
        ...card,
        supportSummary: {
          likes: stats.likes.total,
          dislikes: stats.dislikes.total,
        },
      };
    }),
  );

  res.json(
    createSuccessResponse(
      {
        scope: "world" as const,
        scopeLabel: "World",
        source: "projection" as const,
        generatedAt: new Date().toISOString(),
        initiatives,
      },
      "World initiatives projection loaded.",
    ),
  );
});

export default publicWorldInitiativesRouter;
