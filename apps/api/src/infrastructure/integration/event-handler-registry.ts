import type { CanonicalDomainEventEnvelope } from "../events/domain-event.js";

export type DomainEventHandler = (
  envelope: CanonicalDomainEventEnvelope,
) => Promise<void>;

export interface RegisteredDomainEventHandler {
  consumerId: string;
  eventName: string | "*";
  handle: DomainEventHandler;
}

const handlers: RegisteredDomainEventHandler[] = [];

export function registerDomainEventHandler(handler: RegisteredDomainEventHandler): () => void {
  handlers.push(handler);

  return () => {
    const index = handlers.indexOf(handler);

    if (index >= 0) {
      handlers.splice(index, 1);
    }
  };
}

export function clearDomainEventHandlers(): void {
  handlers.length = 0;
}

export function listDomainEventHandlers(): readonly RegisteredDomainEventHandler[] {
  return handlers;
}

export function getHandlersForEvent(eventName: string): RegisteredDomainEventHandler[] {
  return handlers.filter(
    (handler) => handler.eventName === "*" || handler.eventName === eventName,
  );
}

export async function dispatchEnvelopeToHandlers(
  envelope: CanonicalDomainEventEnvelope,
  invoke: (
    handler: RegisteredDomainEventHandler,
    envelope: CanonicalDomainEventEnvelope,
  ) => Promise<void>,
): Promise<void> {
  const matchingHandlers = getHandlersForEvent(envelope.eventName);

  for (const handler of matchingHandlers) {
    await invoke(handler, envelope);
  }
}
