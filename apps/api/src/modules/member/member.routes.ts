import { Router } from "express";
import { authenticationMiddleware } from "../auth/auth.middleware.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { getSampleMemberById } from "./member.sample.js";

const memberRouter = Router();

memberRouter.get("/me", authenticationMiddleware, (req, res) => {
  const member = getSampleMemberById(req.auth!.memberId);

  if (!member) {
    res.status(404).json({
      success: false,
      data: null,
      meta: {},
      links: {},
      message: "Member not found.",
    });
    return;
  }

  res.json(createSuccessResponse(member, "Member profile loaded."));
});

export default memberRouter;
