import { Router } from "express";
import { createSuccessResponse } from "../../shared/http-response.js";
import { getCurrentAuthIdentity } from "./auth.identity.js";

const authRouter = Router();

const notImplementedResponse = {
  success: false,
  data: null,
  meta: {},
  links: {},
  message: "Not implemented.",
};

authRouter.get("/me", (_req, res) => {
  res.json(createSuccessResponse(getCurrentAuthIdentity()));
});

authRouter.post("/login", (_req, res) => {
  res.status(501).json(notImplementedResponse);
});

authRouter.post("/logout", (_req, res) => {
  res.status(501).json(notImplementedResponse);
});

authRouter.post("/refresh", (_req, res) => {
  res.status(501).json(notImplementedResponse);
});

export default authRouter;
