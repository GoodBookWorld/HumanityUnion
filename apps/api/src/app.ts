import cors from "cors";
import express from "express";
import helmet from "helmet";
import authRouter from "./modules/auth/auth.routes.js";
import {
  collaborativeAnalysisRouter,
  initiativeCollaborativeAnalysisRouter,
  publicCollaborativeAnalysisRouter,
} from "./modules/collaborative-analysis/index.js";
import {
  collectiveDecisionRouter,
  initiativeCollectiveDecisionRouter,
  publicCollectiveDecisionRouter,
} from "./modules/collective-decision/index.js";
import {
  civicCompatibilityReviewRouter,
  publicCivicCompatibilityReviewRouter,
  publicCivicCompatibilityReviewsByInitiativeRouter,
} from "./modules/civic-compatibility-review/index.js";
import {
  decisionSessionRouter,
  publicDecisionSessionRouter,
  publicDecisionSessionsByInitiativeRouter,
} from "./modules/decision-session/index.js";
import {
  initiativeCollectiveDecisionVoteRouter,
  publicInitiativeCollectiveDecisionRouter,
  publicInitiativeCollectiveDecisionsByInitiativeRouter,
} from "./modules/initiative-collective-decision/index.js";
import {
  initiativeCollaborativeAnalysisLifecycleRouter,
  publicInitiativeCollaborativeAnalysisRouter,
  publicInitiativeCollaborativeAnalysesByInitiativeRouter,
} from "./modules/initiative-collaborative-analysis/index.js";
import {
  initiativeImprovementProposalRouter,
  publicInitiativeImprovementProposalRouter,
  publicInitiativeImprovementProposalsByAnalysisRouter,
  publicInitiativeImprovementProposalsByInitiativeRouter,
} from "./modules/initiative-improvement-proposal/index.js";
import {
  initiativeVersionRevisionRouter,
  publicInitiativeVersionRevisionRouter,
} from "./modules/initiative-version-revision/index.js";
import {
  implementationCommitmentRouter,
  publicImplementationCommitmentRouter,
} from "./modules/implementation-commitment/index.js";
import {
  implementationRouter,
  publicImplementationRouter,
} from "./modules/implementation/index.js";
import { petitionRouter, publicPetitionRouter } from "./modules/petition/index.js";
import initiativesRouter from "./modules/initiatives/initiative.routes.js";
import publicInitiativeRouter from "./modules/initiatives/public-initiative.routes.js";
import publicLatestInitiativesRouter from "./modules/initiatives/public-latest-initiatives.routes.js";
import memberRouter from "./modules/member/member.routes.js";
import participationRouter from "./modules/participation/participation.routes.js";
import preferencesRouter from "./modules/preferences/preferences.routes.js";
import healthRouter from "./routes/health.routes.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use("/api/v1/health", healthRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/members", memberRouter);
app.use("/api/v1/initiatives", initiativeCollaborativeAnalysisRouter);
app.use("/api/v1/initiatives", initiativeCollectiveDecisionRouter);
app.use("/api/v1/initiatives", initiativesRouter);
app.use("/api/v1/initiative-analyses", initiativeCollaborativeAnalysisLifecycleRouter);
app.use("/api/v1/improvement-proposals", initiativeImprovementProposalRouter);
app.use("/api/v1/decision-sessions", decisionSessionRouter);
app.use("/api/v1/initiative-collective-decisions", initiativeCollectiveDecisionVoteRouter);
app.use("/api/v1/civic-compatibility-reviews", civicCompatibilityReviewRouter);
app.use("/api/v1/initiative-revisions", initiativeVersionRevisionRouter);
app.use("/api/v1/collaborative-analysis", collaborativeAnalysisRouter);
app.use("/api/v1/collective-decisions", collectiveDecisionRouter);
app.use("/api/v1/petitions", petitionRouter);
app.use("/api/v1/implementation-commitments", implementationCommitmentRouter);
app.use("/api/v1/implementations", implementationRouter);
app.use("/api/v1/public/implementations", publicImplementationRouter);
app.use("/api/v1/public/implementation-commitments", publicImplementationCommitmentRouter);
app.use("/api/v1/public/petitions", publicPetitionRouter);
app.use("/api/v1/public/collective-decisions", publicCollectiveDecisionRouter);
app.use("/api/v1/public/collaborative-analysis", publicCollaborativeAnalysisRouter);
app.use("/api/v1/public/initiative-analyses", publicInitiativeCollaborativeAnalysisRouter);
app.use("/api/v1/public/initiative-analyses", publicInitiativeImprovementProposalsByAnalysisRouter);
app.use("/api/v1/public/improvement-proposals", publicInitiativeImprovementProposalRouter);
app.use("/api/v1/public/decision-sessions", publicDecisionSessionRouter);
app.use("/api/v1/public/initiative-collective-decisions", publicInitiativeCollectiveDecisionRouter);
app.use("/api/v1/public/compatibility-reviews", publicCivicCompatibilityReviewRouter);
app.use("/api/v1/public/initiatives", publicInitiativeCollaborativeAnalysesByInitiativeRouter);
app.use("/api/v1/public/initiatives", publicInitiativeImprovementProposalsByInitiativeRouter);
app.use("/api/v1/public/initiatives", publicDecisionSessionsByInitiativeRouter);
app.use("/api/v1/public/initiatives", publicInitiativeCollectiveDecisionsByInitiativeRouter);
app.use("/api/v1/public/initiatives", publicCivicCompatibilityReviewsByInitiativeRouter);
app.use("/api/v1/public/initiatives", publicInitiativeVersionRevisionRouter);
app.use("/api/v1/public/initiatives", publicInitiativeRouter);
app.use("/api/v1/public/projections", publicLatestInitiativesRouter);
app.use("/api/v1/participation", participationRouter);
app.use("/api/v1/preferences", preferencesRouter);

export default app;
