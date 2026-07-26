import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export interface CorrelationContext {
  correlationId: string;
  causationId: string | null;
  actorId: string | null;
}

const correlationStorage = new AsyncLocalStorage<CorrelationContext>();

export function createCorrelationId(): string {
  return randomUUID();
}

export function createCausationId(): string {
  return randomUUID();
}

export function getCorrelationContext(): CorrelationContext | undefined {
  return correlationStorage.getStore();
}

export function runWithCorrelationContext<T>(
  context: CorrelationContext,
  fn: () => T,
): T {
  return correlationStorage.run(context, fn);
}

export function runWithNewCorrelationContext<T>(
  input: Partial<CorrelationContext> = {},
  fn: () => T,
): T {
  return runWithCorrelationContext(
    {
      correlationId: input.correlationId ?? createCorrelationId(),
      causationId: input.causationId ?? null,
      actorId: input.actorId ?? null,
    },
    fn,
  );
}

export function deriveChildCorrelationContext(
  parent: CorrelationContext,
  causationEventId: string,
): CorrelationContext {
  return {
    correlationId: parent.correlationId,
    causationId: causationEventId,
    actorId: parent.actorId,
  };
}

/** HTTP header name for inbound correlation propagation. */
export const CORRELATION_ID_HEADER = "x-correlation-id";

export function readCorrelationIdFromHeader(
  headerValue: string | string[] | undefined,
): string | null {
  if (typeof headerValue === "string" && headerValue.trim() !== "") {
    return headerValue.trim();
  }

  if (Array.isArray(headerValue) && headerValue[0]?.trim()) {
    return headerValue[0].trim();
  }

  return null;
}
