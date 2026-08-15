"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import type {
  HumanityUnionAssistantSurfaceId,
  InitiativeLifecycleStageId,
} from "@hu/types";

export interface OpenHumanityUnionAssistantInput {
  readonly surfaceId: HumanityUnionAssistantSurfaceId;
  readonly initiativeId?: string;
  readonly stageId?: InitiativeLifecycleStageId;
  readonly pagePath?: string;
  /** Element to restore focus to after the modal closes. */
  readonly returnFocusRef?: RefObject<HTMLElement | null>;
}

interface HumanityUnionAssistantContextValue {
  readonly isOpen: boolean;
  readonly target: OpenHumanityUnionAssistantInput | null;
  readonly hasDedicatedWidget: boolean;
  readonly openAssistant: (input: OpenHumanityUnionAssistantInput) => void;
  readonly closeAssistant: () => void;
  /** Workspace sidebar Widget registers so the floating launcher stays hidden. */
  readonly registerDedicatedWidget: () => void;
  readonly unregisterDedicatedWidget: () => void;
}

const HumanityUnionAssistantContext = createContext<HumanityUnionAssistantContextValue | null>(
  null,
);

export function HumanityUnionAssistantProvider({ children }: { readonly children: ReactNode }) {
  const [target, setTarget] = useState<OpenHumanityUnionAssistantInput | null>(null);
  const [dedicatedWidgetCount, setDedicatedWidgetCount] = useState(0);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const openAssistant = useCallback((input: OpenHumanityUnionAssistantInput) => {
    if (input.returnFocusRef?.current) {
      returnFocusRef.current = input.returnFocusRef.current;
    } else if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      returnFocusRef.current = document.activeElement;
    } else {
      returnFocusRef.current = null;
    }

    setTarget({
      ...input,
      pagePath:
        input.pagePath ?? (typeof window !== "undefined" ? window.location.pathname : undefined),
    });
  }, []);

  const closeAssistant = useCallback(() => {
    setTarget(null);
    const focusTarget = returnFocusRef.current;
    returnFocusRef.current = null;
    queueMicrotask(() => {
      focusTarget?.focus?.();
    });
  }, []);

  const registerDedicatedWidget = useCallback(() => {
    setDedicatedWidgetCount((count) => count + 1);
  }, []);

  const unregisterDedicatedWidget = useCallback(() => {
    setDedicatedWidgetCount((count) => Math.max(0, count - 1));
  }, []);

  const value = useMemo(
    () => ({
      isOpen: target !== null,
      target,
      hasDedicatedWidget: dedicatedWidgetCount > 0,
      openAssistant,
      closeAssistant,
      registerDedicatedWidget,
      unregisterDedicatedWidget,
    }),
    [
      closeAssistant,
      dedicatedWidgetCount,
      openAssistant,
      registerDedicatedWidget,
      target,
      unregisterDedicatedWidget,
    ],
  );

  return (
    <HumanityUnionAssistantContext.Provider value={value}>
      {children}
    </HumanityUnionAssistantContext.Provider>
  );
}

export function useHumanityUnionAssistant(): HumanityUnionAssistantContextValue {
  const value = useContext(HumanityUnionAssistantContext);
  if (!value) {
    throw new Error("useHumanityUnionAssistant requires HumanityUnionAssistantProvider.");
  }
  return value;
}

export function useOptionalHumanityUnionAssistant(): HumanityUnionAssistantContextValue | null {
  return useContext(HumanityUnionAssistantContext);
}
