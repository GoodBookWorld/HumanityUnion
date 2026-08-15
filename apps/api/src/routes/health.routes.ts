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
        /** Process is up (deployment liveness). */
        liveness: "alive",
        /** Durable data plane ready — Mongo required in production. */
        ready: mongo.connected,
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

/** Readiness probe — 503 when Mongo is unavailable (production traffic gate). */
healthRouter.get("/ready", async (_req, res) => {
  const mongo = await checkMongoConnection();
  if (!mongo.connected) {
    res.status(503).json({
      success: false,
      data: { ready: false, mongodb: mongo },
      meta: {},
      links: {},
      message: "API not ready: MongoDB unavailable.",
    });
    return;
  }

  res.json(
    createSuccessResponse(
      { ready: true, mongodb: mongo },
      "API ready.",
    ),
  );
});

export default healthRouter;
