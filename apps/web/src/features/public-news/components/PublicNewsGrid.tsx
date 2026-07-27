import type { ReactNode } from "react";

interface PublicNewsGridProps {
  children: ReactNode;
}

export function PublicNewsGrid({ children }: PublicNewsGridProps) {
  return (
    <div className="public-news-grid" role="list">
      {children}
    </div>
  );
}
