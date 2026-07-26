import { Router } from "express";
import { createSuccessResponse } from "../../shared/http-response.js";
import { getMemberByUniqueName } from "../member/member-access.js";
import { findPreferencesByMemberId } from "../preferences/preferences.repository.js";
import {
  resolvePublicParticipationVisibility,
  toPublicParticipationProfile,
} from "./participation.projection.js";

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

participationRouter.get("/public/:uniqueName", async (req, res) => {
  const member = await getMemberByUniqueName(req.params.uniqueName);

  if (!member) {
    res.status(404).json(createFailureResponse("Public participation profile not found."));
    return;
  }

  try {
    const preferences = await findPreferencesByMemberId(member.id);

    if (!preferences) {
      res.status(404).json(createFailureResponse("Public participation profile not found."));
      return;
    }

    res.json(
      createSuccessResponse(
        toPublicParticipationProfile(
          member,
          preferences,
          resolvePublicParticipationVisibility(preferences),
        ),
        "Public participation profile loaded.",
      ),
    );
  } catch {
    res.status(503).json(createFailureResponse("Public participation profile is unavailable."));
  }
});

export default participationRouter;
