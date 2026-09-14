import type { ReactNode } from "react";

import {
  MediaSemanticNode,
  type MediaSemanticOwner,
  type MediaSemanticResult,
} from "../../language/media-plp/media-semantic-contract";
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
  /** Reset 03E.1 — when set, chrome text emits rendered semantic contracts. */
  chromeSemanticOwner?: MediaSemanticOwner;
  chromeSemanticResult?: MediaSemanticResult;
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
  chromeSemanticOwner,
  chromeSemanticResult,
}: HorizontalSectionShellProps) {
  const markChrome = chromeSemanticOwner != null && chromeSemanticResult != null;
  const wrapChrome = (tag: "p" | "h2", classNameValue: string, id: string | undefined, text: string) =>
    markChrome ? (
      <MediaSemanticNode
        as={tag}
        className={classNameValue}
        id={id}
        owner={chromeSemanticOwner}
        result={chromeSemanticResult}
      >
        {text}
      </MediaSemanticNode>
    ) : tag === "h2" ? (
      <h2 id={id} className={classNameValue}>
        {text}
      </h2>
    ) : (
      <p className={classNameValue}>{text}</p>
    );

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
            {eyebrow
              ? wrapChrome("p", "horizontal-section-shell__eyebrow", undefined, eyebrow)
              : null}
            <div className="horizontal-section-shell__title-row">
              {wrapChrome("h2", "horizontal-section-shell__title", headingId, heading)}
              <div className="horizontal-section-shell__title-actions">
                {headerAction ? (
                  <div className="horizontal-section-shell__header-action">{headerAction}</div>
                ) : null}
                {controls ? (
                  <div className="horizontal-section-shell__controls">{controls}</div>
                ) : null}
              </div>
            </div>
            {description
              ? wrapChrome(
                  "p",
                  "horizontal-section-shell__description",
                  undefined,
                  description,
                )
              : null}
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
