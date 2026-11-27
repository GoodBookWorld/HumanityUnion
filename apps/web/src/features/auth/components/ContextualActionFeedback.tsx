"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { queueContextualFeedbackReveal } from "../reveal-contextual-feedback";
import { AuthFeedbackMessage, type AuthFeedbackVariant } from "./AuthFeedbackMessage";

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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    queueContextualFeedbackReveal(ref.current);
  }, [noticeKey]);

  return (
    <div ref={ref} className="account-panel__action-feedback">
      <AuthFeedbackMessage variant={variant} title={title}>
        {children}
      </AuthFeedbackMessage>
    </div>
  );
}
