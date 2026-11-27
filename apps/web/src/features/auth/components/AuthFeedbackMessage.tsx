import type { ReactNode } from "react";

import "./auth-form.css";

export type AuthFeedbackVariant = "info" | "success" | "warning" | "error";

interface AuthFeedbackMessageProps {
  variant: AuthFeedbackVariant;
  title?: string;
  children: ReactNode;
  id?: string;
}

export function AuthFeedbackMessage({ variant, title, children, id }: AuthFeedbackMessageProps) {
  const role = variant === "error" ? "alert" : "status";
  const heading = title?.trim();

  return (
    <div
      id={id}
      className={`auth-feedback auth-feedback--${variant}`}
      role={role}
      aria-live={variant === "error" ? "assertive" : "polite"}
    >
      {heading ? <p className="auth-feedback__label">{heading}</p> : null}
      <div className="auth-feedback__content">{children}</div>
    </div>
  );
}
