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
  implementationCommitmentRouter,
  publicImplementationCommitmentRouter,
} from "./modules/implementation-commitment/index.js";
import { petitionRouter, publicPetitionRouter } from "./modules/petition/index.js";
import initiativesRouter from "./modules/initiatives/initiative.routes.js";
import publicInitiativeRouter from "./modules/initiatives/public-initiative.routes.js";
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
app.use("/api/v1/collaborative-analysis", collaborativeAnalysisRouter);
app.use("/api/v1/collective-decisions", collectiveDecisionRouter);
app.use("/api/v1/petitions", petitionRouter);
app.use("/api/v1/implementation-commitments", implementationCommitmentRouter);
app.use("/api/v1/public/implementation-commitments", publicImplementationCommitmentRouter);
app.use("/api/v1/public/petitions", publicPetitionRouter);
app.use("/api/v1/public/collective-decisions", publicCollectiveDecisionRouter);
app.use("/api/v1/public/collaborative-analysis", publicCollaborativeAnalysisRouter);
app.use("/api/v1/public/initiatives", publicInitiativeRouter);
app.use("/api/v1/participation", participationRouter);
app.use("/api/v1/preferences", preferencesRouter);

export default app;
