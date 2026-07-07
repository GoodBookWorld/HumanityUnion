import Link from "next/link";
import type { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  href?: string;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
}

export function Button({
  children,
  href,
  variant = "secondary",
  disabled = false,
  type = "button",
  onClick,
}: ButtonProps) {
  const className = `hu-button hu-button--${variant}`;

  if (href) {
    return (
      <Link href={href} className={className} aria-disabled={disabled || undefined}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={className} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
