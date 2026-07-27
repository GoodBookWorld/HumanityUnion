import type { ReactNode } from "react";

import "./auth-form.css";

export type AuthFeedbackVariant = "info" | "success" | "warning" | "error";

interface AuthFeedbackMessageProps {
  variant: AuthFeedbackVariant;
  title?: string;
  children: ReactNode;
  id?: string;
}

const VARIANT_LABELS: Record<AuthFeedbackVariant, string> = {
  info: "Information",
  success: "Success",
  warning: "Notice",
  error: "Error",
};

export function AuthFeedbackMessage({ variant, title, children, id }: AuthFeedbackMessageProps) {
  const role = variant === "error" ? "alert" : "status";

  return (
    <div
      id={id}
      className={`auth-feedback auth-feedback--${variant}`}
      role={role}
      aria-live={variant === "error" ? "assertive" : "polite"}
    >
      <p className="auth-feedback__label">{title ?? VARIANT_LABELS[variant]}</p>
      <div className="auth-feedback__content">{children}</div>
    </div>
  );
}
