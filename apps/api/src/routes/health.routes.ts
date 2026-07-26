import { Router } from "express";

import { environment } from "../config/environment.js";
import { resolvePlatformMode } from "../config/platform.config.js";
import { checkMongoConnection } from "../infrastructure/mongodb/mongo-health.js";
import { getEmailProviderHealth } from "../modules/email/email.service.js";
import { buildPlatformReadinessChecklist } from "../modules/closed-beta/closed-beta.service.js";
import { getOutboxHealthStatus } from "../infrastructure/outbox/outbox.dispatcher.js";
import { createSuccessResponse } from "../shared/http-response.js";

const healthRouter = Router();
const startedAt = Date.now();

healthRouter.get("/", async (_req, res) => {
  const mongo = await checkMongoConnection();
  const email = await getEmailProviderHealth();
  const outbox = await getOutboxHealthStatus();
  const checklist = await buildPlatformReadinessChecklist();
  const failedChecks = checklist.filter((item) => item.status === "fail").length;
  const outboxDegraded =
    outbox.configured && outbox.enabled && outbox.stats !== null && outbox.stats.failed > 0;
  const status = mongo.connected
    ? email.healthy && failedChecks === 0 && !outboxDegraded
      ? "healthy"
      : "degraded"
    : environment.nodeEnv === "production"
      ? "degraded"
      : "healthy";

  res.json(
    createSuccessResponse(
      {
        service: "Humanity Union API",
        version: environment.platformVersion,
        status,
        uptimeSeconds: Math.floor(process.uptime()),
        startedAt: new Date(startedAt).toISOString(),
        environment: environment.nodeEnv,
        platformMode: resolvePlatformMode(),
        mongodb: mongo,
        email,
        outbox,
        readiness: {
          failedChecks,
          checklist,
        },
      },
      "Humanity Union API is running.",
    ),
  );
});

export default healthRouter;
