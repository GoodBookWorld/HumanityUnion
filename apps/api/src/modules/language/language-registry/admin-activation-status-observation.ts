/**
 * Narrow timing log for Admin activation-status.
 * No catalog text, record bodies, provider payloads, or credentials.
 * Phase splits (CT / PLP presence / WEB_UI) are not logged: that would thread
 * timers through readiness. Total duration and in-flight count are the signal.
 */

import { logger } from "../../../shared/observability/logger.js";

type LogFn = (message: string, fields: Readonly<Record<string, unknown>>) => void;

let inFlight = 0;

const ALLOWED_FIELDS = [
  "component",
  "correlationId",
  "languageId",
  "locale",
  "inFlightAtStart",
  "durationMs",
  "httpStatus",
  "result",
] as const;

export type AdminActivationStatusObservation = {
  readonly inFlightAtStart: number;
  complete(input: {
    readonly result: "ok" | "error";
    readonly httpStatus: number;
    readonly locale: string | null;
  }): void;
};

export function beginAdminActivationStatusObservation(input: {
  readonly correlationId: string;
  readonly languageId: string;
  readonly log?: LogFn;
}): AdminActivationStatusObservation {
  const log = input.log ?? ((message, fields) => logger.info(message, fields));
  const inFlightAtStart = inFlight;
  inFlight += 1;
  const startedMs = Date.now();
  log("admin.activation_status.start", {
    component: "admin-languages",
    correlationId: input.correlationId,
    languageId: input.languageId,
    inFlightAtStart,
  });
  let completed = false;
  return {
    inFlightAtStart,
    complete(result) {
      if (completed) {
        return;
      }
      completed = true;
      inFlight = Math.max(0, inFlight - 1);
      log("admin.activation_status.complete", {
        component: "admin-languages",
        correlationId: input.correlationId,
        languageId: input.languageId,
        locale: result.locale,
        inFlightAtStart,
        durationMs: Math.max(0, Date.now() - startedMs),
        httpStatus: result.httpStatus,
        result: result.result,
      });
    },
  };
}

export function adminActivationStatusInFlightForTests(): number {
  return inFlight;
}

export function resetAdminActivationStatusObservationForTests(): void {
  inFlight = 0;
}

export const ADMIN_ACTIVATION_STATUS_LOG_FIELDS = ALLOWED_FIELDS;
