import type { ReactNode } from "react";

import type { HorizontalSectionVariant, HorizontalSurfaceStyle } from "./horizontal-section.types";

import "./horizontal-section-tokens.css";
import "./civic-media-section-shell.css";

interface HorizontalSectionShellProps {
  sectionId: string;
  headingId: string;
  variant?: HorizontalSectionVariant;
  surfaceStyle?: HorizontalSurfaceStyle;
  eyebrow?: string;
  heading: string;
  description?: string;
  metadata?: ReactNode;
  headerAction?: ReactNode;
  controls?: ReactNode;
  footer?: ReactNode;
  nested?: boolean;
  className?: string;
  children: ReactNode;
}

export function HorizontalSectionShell({
  sectionId,
  headingId,
  variant = "default",
  surfaceStyle = "elevated",
  eyebrow,
  heading,
  description,
  metadata,
  headerAction,
  controls,
  footer,
  nested = false,
  className,
  children,
}: HorizontalSectionShellProps) {
  return (
    <section
      id={nested ? undefined : sectionId}
      className={[
        "horizontal-section-shell",
        `horizontal-section-shell--${variant}`,
        `horizontal-section-shell--${surfaceStyle}`,
        nested ? "horizontal-section-shell--nested" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-labelledby={headingId}
    >
      <div className="horizontal-section-shell__inner">
        <header className="horizontal-section-shell__header">
          <div className="horizontal-section-shell__heading-block">
            {eyebrow ? <p className="horizontal-section-shell__eyebrow">{eyebrow}</p> : null}
            <div className="horizontal-section-shell__title-row">
              <h2 id={headingId} className="horizontal-section-shell__title">
                {heading}
              </h2>
              <div className="horizontal-section-shell__title-actions">
                {headerAction ? (
                  <div className="horizontal-section-shell__header-action">{headerAction}</div>
                ) : null}
                {controls ? (
                  <div className="horizontal-section-shell__controls">{controls}</div>
                ) : null}
              </div>
            </div>
            {description ? (
              <p className="horizontal-section-shell__description">{description}</p>
            ) : null}
            {metadata ? (
              <div className="horizontal-section-shell__metadata">{metadata}</div>
            ) : null}
          </div>
        </header>

        <div className="horizontal-section-shell__content">{children}</div>

        {footer ? <footer className="horizontal-section-shell__footer">{footer}</footer> : null}
      </div>
    </section>
  );
}

/** @deprecated Use HorizontalSectionShell */
export const CivicMediaSectionShell = HorizontalSectionShell;

export type CivicMediaSectionShellProps = HorizontalSectionShellProps;
