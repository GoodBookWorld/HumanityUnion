import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return <div className={className ? `hu-card ${className}` : "hu-card"}>{children}</div>;
}
