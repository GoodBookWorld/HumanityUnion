import { Router, type Response } from "express";

import { createSuccessResponse } from "../../../shared/http-response.js";
import { TerminologyGlossaryPersistenceError } from "./terminology-glossary.errors.js";
import { resolveControlledLifecyclePreferredTermsForLocale } from "./terminology-glossary.public.js";

const publicTerminologyGlossaryRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

/**
 * GET /api/v1/terminology-glossary/controlled-lifecycle-preferred-terms?locale=
 * Public maps of lifecycle stageId / controlled conceptId → published preferredTerm.
 */
publicTerminologyGlossaryRouter.get(
  "/controlled-lifecycle-preferred-terms",
  async (req, res: Response) => {
    try {
      const localeParam = req.query.locale;
      const locale =
        typeof localeParam === "string"
          ? localeParam
          : Array.isArray(localeParam)
            ? String(localeParam[0] ?? "")
            : "";

      if (!locale.trim()) {
        res
          .status(400)
          .json(createFailureResponse("locale query parameter is required."));
        return;
      }

      const resolved = await resolveControlledLifecyclePreferredTermsForLocale(locale);
      res.json(
        createSuccessResponse(
          resolved,
          "Controlled lifecycle preferred terms resolved.",
        ),
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Terminology preferred-term request failed.";
      const status =
        error instanceof TerminologyGlossaryPersistenceError ? 503 : 500;
      res.status(status).json(createFailureResponse(message));
    }
  },
);

export default publicTerminologyGlossaryRouter;
