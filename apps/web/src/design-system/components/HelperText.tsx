import type { ReactNode } from "react";

interface HelperTextProps {
  children: ReactNode;
}

export function HelperText({ children }: HelperTextProps) {
  return <p className="hu-helper-text">{children}</p>;
}
