/**
 * Reset 03C.2 — Media PLP locale-switch state machine + test instrumentation.
 * Pure helpers: no provider, no generate-on-miss, no participant-facing UI.
 */

export type MediaLocaleSwitchPhase =
  | "idle"
  | "started"
  | "resolving"
  | "completed"
  | "failed_closed";

export type MediaPresentationResolutionMode =
  | "PUBLISHED_LOCALIZED"
  | "CANONICAL_FALLBACK"
  | "FLAG_OFF_LEGACY"
  | "API_UNAVAILABLE_FALLBACK";

export type MediaLocaleSwitchEvent =
  | { readonly type: "LOCALE_SWITCH_STARTED"; readonly locale: string }
  | { readonly type: "LOCALE_SWITCH_COMPLETED"; readonly locale: string }
  | {
      readonly type: "FINAL_INTERFACE_LOCALE";
      readonly locale: string;
    }
  | {
      readonly type: "MEDIA_PRESENTATION_RESOLUTION";
      readonly locale: string;
      readonly mode: MediaPresentationResolutionMode;
      readonly entityId?: string;
    }
  | {
      readonly type: "MEDIA_SEMANTIC_MUTATIONS_AFTER_SETTLE";
      readonly count: number;
    }
  | {
      readonly type: "CLIENT_TRANSLATION_REQUEST_COUNT";
      readonly count: number;
    };

export type MediaLocaleSwitchSnapshot = {
  readonly phase: MediaLocaleSwitchPhase;
  readonly requestedLocale: string | null;
  readonly finalInterfaceLocale: string | null;
  readonly presentationResolutions: readonly {
    readonly locale: string;
    readonly mode: MediaPresentationResolutionMode;
    readonly entityId?: string;
  }[];
  readonly semanticMutationsAfterSettle: number;
  readonly clientTranslationRequestCount: number;
  readonly events: readonly MediaLocaleSwitchEvent[];
};

const emptySnapshot = (): MediaLocaleSwitchSnapshot => ({
  phase: "idle",
  requestedLocale: null,
  finalInterfaceLocale: null,
  presentationResolutions: [],
  semanticMutationsAfterSettle: 0,
  clientTranslationRequestCount: 0,
  events: [],
});

let snapshot: MediaLocaleSwitchSnapshot = emptySnapshot();

export function resetMediaLocaleSwitchInstrumentation(): void {
  snapshot = emptySnapshot();
}

export function getMediaLocaleSwitchSnapshot(): MediaLocaleSwitchSnapshot {
  return snapshot;
}

function pushEvent(event: MediaLocaleSwitchEvent): void {
  snapshot = {
    ...snapshot,
    events: [...snapshot.events, event],
  };
}

export function recordLocaleSwitchStarted(locale: string): void {
  snapshot = {
    ...snapshot,
    phase: "started",
    requestedLocale: locale,
  };
  pushEvent({ type: "LOCALE_SWITCH_STARTED", locale });
}

export function recordLocaleSwitchResolving(): void {
  if (snapshot.phase === "started" || snapshot.phase === "resolving") {
    snapshot = { ...snapshot, phase: "resolving" };
  }
}

export function recordMediaPresentationResolution(input: {
  readonly locale: string;
  readonly mode: MediaPresentationResolutionMode;
  readonly entityId?: string;
}): void {
  snapshot = {
    ...snapshot,
    presentationResolutions: [
      ...snapshot.presentationResolutions,
      {
        locale: input.locale,
        mode: input.mode,
        entityId: input.entityId,
      },
    ],
  };
  pushEvent({
    type: "MEDIA_PRESENTATION_RESOLUTION",
    locale: input.locale,
    mode: input.mode,
    entityId: input.entityId,
  });
}

export function recordLocaleSwitchCompleted(locale: string): void {
  snapshot = {
    ...snapshot,
    phase: "completed",
    finalInterfaceLocale: locale,
  };
  pushEvent({ type: "LOCALE_SWITCH_COMPLETED", locale });
  pushEvent({ type: "FINAL_INTERFACE_LOCALE", locale });
}

export function recordLocaleSwitchFailedClosed(locale: string): void {
  snapshot = {
    ...snapshot,
    phase: "failed_closed",
    finalInterfaceLocale: locale,
  };
  pushEvent({ type: "LOCALE_SWITCH_COMPLETED", locale });
  pushEvent({ type: "FINAL_INTERFACE_LOCALE", locale });
}

export function recordSemanticMutationsAfterSettle(count: number): void {
  snapshot = {
    ...snapshot,
    semanticMutationsAfterSettle: count,
  };
  pushEvent({ type: "MEDIA_SEMANTIC_MUTATIONS_AFTER_SETTLE", count });
}

export function recordClientTranslationRequestCount(count: number): void {
  snapshot = {
    ...snapshot,
    clientTranslationRequestCount: count,
  };
  pushEvent({ type: "CLIENT_TRANSLATION_REQUEST_COUNT", count });
}

/**
 * Models the 03C.1 PLP client settle loop:
 * parent allocates a new editorial object every render; skipClientTranslation
 * effect calls setEditorial(initialEditorial) on identity change → re-render.
 * Returns whether the transition settles within maxRenders.
 */
export function simulatePlpEditorialIdentityEffectLoop(input: {
  readonly stabilizeEditorialIdentity: boolean;
  readonly maxRenders?: number;
}): {
  readonly settled: boolean;
  readonly renders: number;
  readonly setEditorialCalls: number;
} {
  const maxRenders = input.maxRenders ?? 40;
  let renders = 0;
  let setEditorialCalls = 0;
  let committed: { readonly token: number } | null = null;
  let stableToken = 0;

  while (renders < maxRenders) {
    renders += 1;
    const next: { readonly token: number } = input.stabilizeEditorialIdentity
      ? (committed ?? { token: ++stableToken })
      : { token: renders };

    // Effect dep: initialEditorial identity
    if (committed !== next) {
      setEditorialCalls += 1;
      committed = next;
      continue; // setState → another render
    }
    return { settled: true, renders, setEditorialCalls };
  }

  return { settled: false, renders, setEditorialCalls };
}

/** Locale-switch contract: loading ownership must terminate for every outcome. */
export function localeSwitchMustTerminate(outcome: {
  readonly kind:
    | "published"
    | "canonical_fallback"
    | "api_error"
    | "timeout"
    | "aborted"
    | "repeated_selection";
}): MediaLocaleSwitchPhase {
  switch (outcome.kind) {
    case "published":
    case "canonical_fallback":
    case "repeated_selection":
      return "completed";
    case "api_error":
    case "timeout":
    case "aborted":
      return "failed_closed";
    default: {
      const _exhaustive: never = outcome.kind;
      return _exhaustive;
    }
  }
}
