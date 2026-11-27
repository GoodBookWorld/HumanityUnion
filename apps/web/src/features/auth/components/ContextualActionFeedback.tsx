"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { queueContextualFeedbackReveal } from "../reveal-contextual-feedback";
import { AuthFeedbackMessage, type AuthFeedbackVariant } from "./AuthFeedbackMessage";
import "./contextual-action-feedback.css";

/** Reveals one action result. Several results in the same turn scroll once. */
export function useContextualActionReveal(noticeKey: string | null | undefined) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!noticeKey) {
      return;
    }
    queueContextualFeedbackReveal(ref.current);
  }, [noticeKey]);

  return ref;
}

/**
 * Action result placed with the control that produced it.
 * Reveals the node only when this result is new and outside the viewport.
 */
export function ContextualActionFeedback({
  variant,
  title,
  noticeKey,
  children,
}: {
  variant: AuthFeedbackVariant;
  title?: string;
  noticeKey: string;
  children: ReactNode;
}) {
  const ref = useContextualActionReveal(noticeKey);

  return (
    <div ref={ref} className="contextual-action-feedback">
      <AuthFeedbackMessage variant={variant} title={title}>
        {children}
      </AuthFeedbackMessage>
    </div>
  );
}
