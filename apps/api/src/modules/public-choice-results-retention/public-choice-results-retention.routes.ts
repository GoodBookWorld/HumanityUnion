import { Router } from "express";
import type { Response } from "express";

import {
  isPublicChoiceResultsDownloadAvailable,
  resolveInitiativeLifecycleProfile,
  resolvePublicChoiceVotingCloseAt,
} from "@hu/types";

import { createSuccessResponse } from "../../shared/http-response.js";
import { optionalAuthenticationMiddleware } from "../auth/auth.middleware.js";
import { getDecisionById } from "../initiative-collective-decision/initiative-collective-decision.store.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { attachRuntimeLocale } from "../language/runtime-locale.middleware.js";
import { generatePublicChoiceResultsPdfBuffer } from "./public-choice-results-pdf-export.service.js";
import { ensurePublicChoiceResultsFrozenForClosedDecision } from "./public-choice-results-retention.service.js";
import { findPublicChoiceResultsSnapshotByDecision } from "./public-choice-results-snapshot.repository.js";

export const publicChoiceResultsRetentionRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

function getParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function sendPdf(res: Response, buffer: Buffer, filename: string): void {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(buffer);
}

/**
 * Pack 02C — Download Final Results PDF during the 72-hour retention window.
 * Policy check uses closedAt + retention hours (not physical TTL presence).
 */
publicChoiceResultsRetentionRouter.get(
  "/:initiativeId/public-choice-results/download",
  optionalAuthenticationMiddleware,
  async (req, res) => {
    try {
      const initiativeId = getParam(req.params.initiativeId);
      const decisionIdParam = typeof req.query.decisionId === "string" ? req.query.decisionId : "";

      const initiative = getInitiativeById(initiativeId);
      if (!initiative) {
        res.status(404).json(createFailureResponse("Initiative not found."));
        return;
      }

      if (resolveInitiativeLifecycleProfile(initiative.lifecycleProfile) !== "PUBLIC_CHOICE") {
        res.status(400).json(createFailureResponse("Results download is only for Public Choice."));
        return;
      }

      if (initiative.metadata.publicChoiceResultsExpiredAt) {
        res.status(410).json(
          createFailureResponse("Results retention period ended. Temporary results are no longer available."),
        );
        return;
      }

      const { listDecisionsByInitiative } = await import(
        "../initiative-collective-decision/initiative-collective-decision.store.js"
      );
      const decisions = listDecisionsByInitiative(initiativeId).filter(
        (decision) => decision.status === "opened" || decision.status === "closed",
      );
      const decision =
        (decisionIdParam ? getDecisionById(decisionIdParam) : null) ??
        decisions.find((item) => item.status === "closed") ??
        decisions[0] ??
        null;

      if (!decision || decision.initiativeId !== initiativeId) {
        res.status(404).json(createFailureResponse("Collective decision not found."));
        return;
      }

      const votingCloseAt = resolvePublicChoiceVotingCloseAt({
        status: decision.status,
        closedAt: decision.closedAt,
        closesAt: decision.closesAt,
      });

      const downloadAvailable = isPublicChoiceResultsDownloadAvailable({
        votingOpen: false,
        votingCloseAt,
        resultsExpiredAt: initiative.metadata.publicChoiceResultsExpiredAt,
      });

      // Refuse before close and after retention — even if Mongo still has rows.
      if (!votingCloseAt || !downloadAvailable) {
        const now = Date.now();
        const closeMs = votingCloseAt ? Date.parse(votingCloseAt) : NaN;
        if (!votingCloseAt || Number.isNaN(closeMs) || now < closeMs) {
          res.status(409).json(createFailureResponse("Results download is available after voting closes."));
          return;
        }

        res.status(410).json(
          createFailureResponse("Results retention period ended. Temporary results are no longer available."),
        );
        return;
      }

      let snapshot = await findPublicChoiceResultsSnapshotByDecision(decision.decisionId);
      if (!snapshot) {
        snapshot = await ensurePublicChoiceResultsFrozenForClosedDecision({
          initiative,
          decision,
        });
      }

      if (!snapshot) {
        res.status(404).json(createFailureResponse("Final results snapshot is not available."));
        return;
      }

      const runtimeLocale = await attachRuntimeLocale(req);
      const buffer = await generatePublicChoiceResultsPdfBuffer(snapshot, {
        locale: runtimeLocale.locale,
      });
      const filename = `humanity-union-public-choice-results-${initiativeId}.pdf`;
      sendPdf(res, buffer, filename);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Results download failed.";
      res.status(400).json(createFailureResponse(message));
    }
  },
);

/** Lightweight retention status for UI (optional). */
publicChoiceResultsRetentionRouter.get(
  "/:initiativeId/public-choice-results/status",
  optionalAuthenticationMiddleware,
  async (req, res) => {
    try {
      const initiativeId = getParam(req.params.initiativeId);
      const initiative = getInitiativeById(initiativeId);
      if (!initiative) {
        res.status(404).json(createFailureResponse("Initiative not found."));
        return;
      }

      res.json(
        createSuccessResponse(
          {
            resultsExpiredAt: initiative.metadata.publicChoiceResultsExpiredAt ?? null,
            resultsExpireAt: initiative.metadata.publicChoiceResultsExpireAt ?? null,
          },
          "Public Choice results retention status.",
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Status request failed.";
      res.status(400).json(createFailureResponse(message));
    }
  },
);
