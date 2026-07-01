import { Router } from "express";
import { createSuccessResponse } from "../../shared/http-response.js";
import { getMemberByUniqueName } from "../member/member.store.js";
import { getPreferencesByMemberId } from "../preferences/preferences.store.js";
import { toPublicParticipationProfile } from "./participation.projection.js";
import { bootstrapPublicParticipationVisibility } from "./participation.visibility.js";

const participationRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

participationRouter.get("/public/:uniqueName", (req, res) => {
  const member = getMemberByUniqueName(req.params.uniqueName);

  if (!member) {
    res.status(404).json(createFailureResponse("Public participation profile not found."));
    return;
  }

  const preferences = getPreferencesByMemberId(member.id);

  if (!preferences) {
    res.status(404).json(createFailureResponse("Public participation profile not found."));
    return;
  }

  res.json(
    createSuccessResponse(
      toPublicParticipationProfile(member, preferences, bootstrapPublicParticipationVisibility),
      "Public participation profile loaded.",
    ),
  );
});

export default participationRouter;
