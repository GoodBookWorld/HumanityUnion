import type { ReactNode } from "react";

import "../legal-page.css";

interface LegalPageShellProps {
  title: string;
  children: ReactNode;
  counselNote: string;
}

export function LegalPageShell({ title, children, counselNote }: LegalPageShellProps) {
  return (
    <article className="legal-page">
      <header className="legal-page__header">
        <h1>{title}</h1>
        <p className="legal-page__counsel-note" role="note">
          {counselNote}
        </p>
      </header>
      <div className="legal-page__body">{children}</div>
    </article>
  );
}
