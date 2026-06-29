import { Router } from "express";
import { createSuccessResponse } from "../shared/http-response.js";

const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json(
    createSuccessResponse(
      {
        service: "Humanity Union API",
        version: "0.1.0",
        status: "healthy",
      },
      "Humanity Union API is running.",
    ),
  );
});

export default healthRouter;
