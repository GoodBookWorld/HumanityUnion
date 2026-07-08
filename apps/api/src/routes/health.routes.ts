import { Router } from "express";
import { checkMongoConnection } from "../infrastructure/mongodb/mongo-health.js";
import { createSuccessResponse } from "../shared/http-response.js";

const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  const mongo = await checkMongoConnection();

  res.json(
    createSuccessResponse(
      {
        service: "Humanity Union API",
        version: "0.1.0",
        status: "healthy",
        mongodb: mongo,
      },
      "Humanity Union API is running.",
    ),
  );
});

export default healthRouter;
