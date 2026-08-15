import Link from "next/link";
import type { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  href?: string;
  variant?: "primary" | "secondary" | "tertiary" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
  className?: string;
  "aria-label"?: string;
  "aria-pressed"?: boolean | "true" | "false";
  /**
   * Profile UX Pack 02 Part 3/12 — set to `"polite"` on buttons whose label
   * changes on its own (e.g. "Save Profile" -> "Saving..." -> "Saved" ->
   * "Save Profile") so screen reader users hear the state change without
   * needing to be focused-and-re-read manually.
   */
  ariaLive?: "polite" | "off";
}

export function Button({
  children,
  href,
  variant = "secondary",
  disabled = false,
  type = "button",
  onClick,
  className,
  "aria-label": ariaLabel,
  "aria-pressed": ariaPressed,
  ariaLive,
}: ButtonProps) {
  const resolvedClassName = ["hu-button", `hu-button--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  if (href) {
    return (
      <Link
        href={href}
        className={resolvedClassName}
        aria-disabled={disabled || undefined}
        aria-label={ariaLabel}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={resolvedClassName}
      disabled={disabled}
      onClick={onClick}
      aria-live={ariaLive}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
    >
      {children}
    </button>
  );
}
