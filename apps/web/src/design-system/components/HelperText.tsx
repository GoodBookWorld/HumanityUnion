import type { ReactNode } from "react";

interface HelperTextProps {
  children: ReactNode;
  id?: string;
}

export function HelperText({ children, id }: HelperTextProps) {
  return (
    <p id={id} className="hu-helper-text">
      {children}
    </p>
  );
}
