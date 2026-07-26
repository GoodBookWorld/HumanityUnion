import { Router } from "express";
import multer from "multer";

import { requireJwtAuthenticationMiddleware } from "../auth/auth.middleware.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { assertInitiativeOwnership } from "../initiatives/initiative-ownership.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { requestIdentityFromAuth } from "../initiatives/identity/bootstrap-request-identity.js";
import { LocalMediaStorageProvider } from "./local-media.provider.js";
import { MediaUploadService, getMediaRecordById } from "./media-upload.service.js";
import { validateUploadedImageFile } from "./media-upload.validation.js";

const mediaUploadRouter = Router();
const mediaStorageProvider = new LocalMediaStorageProvider();
const mediaUploadService = new MediaUploadService(mediaStorageProvider);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
});

function failure(message: string, status = 400) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
    status,
  };
}

function resolvePublicBaseUrl(req: { protocol: string; get(name: string): string | undefined }) {
  const configured =
    process.env.MEDIA_PUBLIC_BASE_URL?.trim() || process.env.API_PUBLIC_BASE_URL?.trim();

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  const host = req.get("host");

  if (host) {
    return `${req.protocol}://${host}`;
  }

  return "http://localhost:4000";
}

mediaUploadRouter.use(requireJwtAuthenticationMiddleware);

mediaUploadRouter.post("/avatar", upload.single("file"), async (req, res) => {
  try {
    const identity = await requestIdentityFromAuth(req.auth!);
    const validated = validateUploadedImageFile("avatar", req.file);
    const record = await mediaUploadService.uploadMedia({
      purpose: "avatar",
      file: validated,
      ownerUserId: req.auth!.id,
      ownerParticipantId: identity.participantId,
      publicBaseUrl: resolvePublicBaseUrl(req),
    });

    res.json(createSuccessResponse(record, "Avatar uploaded."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Avatar upload failed.";
    res.status(400).json(failure(message));
  }
});

mediaUploadRouter.post("/initiative-image", upload.single("file"), async (req, res) => {
  try {
    const identity = await requestIdentityFromAuth(req.auth!);
    const initiativeId =
      typeof req.body?.initiativeId === "string" ? req.body.initiativeId.trim() : "";

    if (!initiativeId) {
      res.status(400).json(failure("initiativeId is required."));
      return;
    }

    const initiative = getInitiativeById(initiativeId);

    if (!initiative) {
      res.status(404).json(failure("Initiative not found.", 404));
      return;
    }

    assertInitiativeOwnership(initiative, identity);

    const validated = validateUploadedImageFile("initiative-image", req.file);
    const record = await mediaUploadService.uploadMedia({
      purpose: "initiative-image",
      file: validated,
      ownerUserId: req.auth!.id,
      ownerParticipantId: identity.participantId,
      initiativeId,
      publicBaseUrl: resolvePublicBaseUrl(req),
    });

    res.json(createSuccessResponse(record, "Initiative image uploaded."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Initiative image upload failed.";
    const status = message === "Initiative not found." ? 404 : 400;
    res.status(status).json(failure(message, status));
  }
});

mediaUploadRouter.delete("/:mediaId", async (req, res) => {
  try {
    const identity = await requestIdentityFromAuth(req.auth!);
    const mediaId = req.params.mediaId;
    const existing = getMediaRecordById(mediaId);

    if (!existing) {
      res.status(404).json(failure("Media not found.", 404));
      return;
    }

    if (existing.ownerUserId !== req.auth!.id) {
      res.status(403).json(failure("You are not authorized to delete this media.", 403));
      return;
    }

    if (existing.purpose === "initiative-image" && existing.initiativeId) {
      const initiative = getInitiativeById(existing.initiativeId);

      if (initiative) {
        assertInitiativeOwnership(initiative, identity);
      }
    }

    const deleted = await mediaUploadService.deleteMedia(mediaId);

    if (!deleted) {
      res.status(404).json(failure("Media not found.", 404));
      return;
    }

    res.json(createSuccessResponse(deleted, "Media deleted."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Media deletion failed.";
    res.status(400).json(failure(message));
  }
});

export default mediaUploadRouter;
