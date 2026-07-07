import type { ReactNode } from "react";

interface ContextPanelProps {
  title: string;
  children: ReactNode;
}

export function ContextPanel({ title, children }: ContextPanelProps) {
  return (
    <aside className="hu-context-panel">
      <h3 className="hu-context-panel__title">{title}</h3>
      {children}
    </aside>
  );
}
