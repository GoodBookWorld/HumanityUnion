import type { ReactNode } from "react";

import "./hu-feedback-message.css";

export type HuFeedbackVariant = "neutral" | "warning" | "error" | "success";

interface HuFeedbackMessageProps {
  variant: HuFeedbackVariant;
  title?: string;
  children: ReactNode;
  id?: string;
}

const VARIANT_LABELS: Record<HuFeedbackVariant, string> = {
  neutral: "Notice",
  warning: "Notice",
  error: "Error",
  success: "Success",
};

export function HuFeedbackMessage({ variant, title, children, id }: HuFeedbackMessageProps) {
  const role = variant === "error" ? "alert" : "status";

  return (
    <div
      id={id}
      className={`hu-feedback hu-feedback--${variant}`}
      role={role}
      aria-live={variant === "error" ? "assertive" : "polite"}
    >
      <p className="hu-feedback__label">{title ?? VARIANT_LABELS[variant]}</p>
      <div className="hu-feedback__content">{children}</div>
    </div>
  );
}
