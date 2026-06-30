import { Router } from "express";
import { getCurrentAuthIdentity } from "../auth/auth.identity.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { getSampleMemberById } from "./member.sample.js";

const memberRouter = Router();

memberRouter.get("/me", (_req, res) => {
  const { memberId } = getCurrentAuthIdentity();
  const member = getSampleMemberById(memberId);

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
