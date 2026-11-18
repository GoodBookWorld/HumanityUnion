import Link from "next/link";
import type { ReactNode } from "react";

import { ProtectedAuthoritativeText } from "../../language/components/ProtectedAuthoritativeText";
import type { LegalDocumentId, LegalDocumentPresentation } from "../resolve-legal-document-presentation";

import "../legal-page.css";

interface LegalPageShellProps {
  presentation: LegalDocumentPresentation;
  activeDocument: LegalDocumentId;
  children: ReactNode;
}

/**
 * Legal chrome (nav, titles) stays browser-translatable.
 * Authoritative Legal document body — published localized or canonical English
 * fallback — is protected from browser machine translation.
 *
 * HU-PRIVACY-02B — counselNote and expectedFallbackNote are not rendered on
 * public legal pages. Admin Legal Localization retains stale/version diagnostics.
 */
export function LegalPageShell({
  presentation,
  activeDocument,
  children,
}: LegalPageShellProps) {
  const { chrome } = presentation;

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
      </header>
      <ProtectedAuthoritativeText as="div" className="legal-page__body">
        {children}
      </ProtectedAuthoritativeText>
    </article>
  );
}
