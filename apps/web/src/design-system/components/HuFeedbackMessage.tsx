import type { ReactNode } from "react";

import "./hu-feedback-message.css";

export type HuFeedbackVariant = "neutral" | "warning" | "error" | "success";

interface HuFeedbackMessageProps {
  variant: HuFeedbackVariant;
  title?: string;
  children: ReactNode;
  id?: string;
}

export function HuFeedbackMessage({ variant, title, children, id }: HuFeedbackMessageProps) {
  const role = variant === "error" ? "alert" : "status";
  const heading = title?.trim();

  return (
    <div
      id={id}
      className={`hu-feedback hu-feedback--${variant}`}
      role={role}
      aria-live={variant === "error" ? "assertive" : "polite"}
    >
      {heading ? <p className="hu-feedback__label">{heading}</p> : null}
      <div className="hu-feedback__content">{children}</div>
    </div>
  );
}
