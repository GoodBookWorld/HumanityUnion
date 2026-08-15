/**
 * Lifecycle AI public errors — calm, truthful, never leak provider secrets,
 * API keys, system prompts, or raw vendor payloads.
 */

export type LifecycleAiErrorCode =
  | "not_configured"
  | "unavailable"
  | "timeout"
  | "rate_limited"
  | "network_failure"
  | "malformed_response"
  | "safety_refusal"
  | "safety_rejected"
  | "forbidden"
  | "not_found"
  | "bad_request";

const PUBLIC_MESSAGES: Record<LifecycleAiErrorCode, string> = {
  not_configured: "The AI Assistant is not configured for this environment.",
  unavailable: "The AI Assistant is temporarily unavailable.",
  timeout: "The AI Assistant is temporarily unavailable.",
  rate_limited: "The AI Assistant is temporarily unavailable.",
  network_failure: "The AI Assistant is temporarily unavailable.",
  malformed_response: "The AI Assistant is temporarily unavailable.",
  safety_refusal: "This request could not be processed safely.",
  safety_rejected: "This request could not be processed safely.",
  forbidden: "Lifecycle AI Assistant is only available in Author Workspace.",
  not_found: "Initiative or Lifecycle stage not found.",
  bad_request: "This AI Assistant request could not be completed.",
};

export class LifecycleAiError extends Error {
  readonly code: LifecycleAiErrorCode;
  readonly publicMessage: string;
  /** Server-only detail for logs/tests — never sent to the browser as-is. */
  readonly internalDetail?: string;

  constructor(code: LifecycleAiErrorCode, internalDetail?: string) {
    const publicMessage = PUBLIC_MESSAGES[code];
    super(publicMessage);
    this.name = "LifecycleAiError";
    this.code = code;
    this.publicMessage = publicMessage;
    this.internalDetail = internalDetail;
  }
}

export function toLifecycleAiPublicMessage(error: unknown): string {
  if (error instanceof LifecycleAiError) {
    return error.publicMessage;
  }

  if (error instanceof Error) {
    const message = error.message;
    if (/Safety|rejected|review|must not include|credential|private field/i.test(message)) {
      return PUBLIC_MESSAGES.safety_rejected;
    }
    if (/only available in Author Workspace/i.test(message)) {
      return PUBLIC_MESSAGES.forbidden;
    }
    if (/not found/i.test(message)) {
      return PUBLIC_MESSAGES.not_found;
    }
  }

  return PUBLIC_MESSAGES.unavailable;
}

export function resolveLifecycleAiHttpStatus(error: unknown): number {
  if (error instanceof LifecycleAiError) {
    switch (error.code) {
      case "not_found":
        return 404;
      case "forbidden":
        return 403;
      case "safety_rejected":
      case "safety_refusal":
      case "bad_request":
      case "not_configured":
        return 400;
      case "rate_limited":
        return 429;
      default:
        return 503;
    }
  }

  const message = error instanceof Error ? error.message : "";
  if (/not found/i.test(message)) {
    return 404;
  }
  if (/only available in Author Workspace/i.test(message)) {
    return 403;
  }
  if (/Safety|rejected|review|must not include|not allowed|Unknown Lifecycle AI|required/i.test(message)) {
    return 400;
  }

  return 503;
}
