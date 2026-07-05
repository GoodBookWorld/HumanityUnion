import { Router } from "express";
import { authenticationMiddleware } from "../auth/auth.middleware.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { toMemberPublicProjection } from "./member.projection.js";
import {
  getMemberById,
  getMemberByUniqueName,
  updateMemberProfile,
  type EditableMemberProfileFields,
} from "./member.store.js";

const memberRouter = Router();

const EDITABLE_FIELDS = new Set(["displayName", "country", "region", "city", "languages"]);

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

memberRouter.get("/public/:uniqueName", (req, res) => {
  const member = getMemberByUniqueName(req.params.uniqueName);

  if (!member) {
    res.status(404).json(createFailureResponse("Member not found."));
    return;
  }

  res.json(
    createSuccessResponse(toMemberPublicProjection(member), "Public member profile loaded."),
  );
});

memberRouter.get("/me", authenticationMiddleware, (req, res) => {
  const member = getMemberById(req.auth!.memberId);

  if (!member) {
    res.status(404).json(createFailureResponse("Member not found."));
    return;
  }

  res.json(createSuccessResponse(member, "Member profile loaded."));
});

memberRouter.patch("/me", authenticationMiddleware, (req, res) => {
  const body = req.body as Record<string, unknown>;

  for (const key of Object.keys(body)) {
    if (!EDITABLE_FIELDS.has(key)) {
      res.status(400).json(createFailureResponse(`Field "${key}" cannot be modified.`));
      return;
    }
  }

  const fields: EditableMemberProfileFields = {};

  if (body.displayName !== undefined) {
    fields.displayName = String(body.displayName);
  }

  if (body.country !== undefined) {
    fields.country = String(body.country);
  }

  if (body.region !== undefined) {
    fields.region = String(body.region);
  }

  if (body.city !== undefined) {
    fields.city = String(body.city);
  }

  if (body.languages !== undefined) {
    if (
      !Array.isArray(body.languages) ||
      !body.languages.every((value) => typeof value === "string")
    ) {
      res.status(400).json(createFailureResponse('Field "languages" must be an array of strings.'));
      return;
    }

    fields.languages = body.languages;
  }

  const member = updateMemberProfile(req.auth!.memberId, fields);

  if (!member) {
    res.status(404).json(createFailureResponse("Member not found."));
    return;
  }

  res.json(createSuccessResponse(member, "Member profile updated."));
});

export default memberRouter;
