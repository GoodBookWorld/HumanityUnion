import Link from "next/link";
import type { ReactNode } from "react";

import type { LegalDocumentId, LegalDocumentPresentation } from "../resolve-legal-document-presentation";
import { EXPECTED_LEGAL_FALLBACK } from "../resolve-legal-document-presentation";

import "../legal-page.css";

interface LegalPageShellProps {
  presentation: LegalDocumentPresentation;
  activeDocument: LegalDocumentId;
  children: ReactNode;
}

export function LegalPageShell({
  presentation,
  activeDocument,
  children,
}: LegalPageShellProps) {
  const { chrome, body } = presentation;
  const showFallbackNote = body.source === EXPECTED_LEGAL_FALLBACK;

  return (
    <article className="legal-page">
      <header className="legal-page__header">
        <nav className="legal-page__nav" aria-label={chrome.navAriaLabel}>
          <Link
            href="/privacy"
            aria-current={activeDocument === "privacy" ? "page" : undefined}
            className={
              activeDocument === "privacy"
                ? "legal-page__nav-link legal-page__nav-link--active"
                : "legal-page__nav-link"
            }
          >
            {chrome.privacyLabel}
          </Link>
          <Link
            href="/terms"
            aria-current={activeDocument === "terms" ? "page" : undefined}
            className={
              activeDocument === "terms"
                ? "legal-page__nav-link legal-page__nav-link--active"
                : "legal-page__nav-link"
            }
          >
            {chrome.termsLabel}
          </Link>
        </nav>
        <h1>{chrome.title}</h1>
        <p className="legal-page__counsel-note" role="note">
          {chrome.counselNote}
        </p>
        {showFallbackNote ? (
          <p
            className="legal-page__fallback-note"
            role="status"
            data-legal-body-source={EXPECTED_LEGAL_FALLBACK}
          >
            {chrome.expectedFallbackNote}
          </p>
        ) : null}
      </header>
      <div className="legal-page__body">{children}</div>
    </article>
  );
}
