"use client";

import type { ReactNode } from "react";

import {
  HorizontalContentSection,
  type HorizontalContentSectionProps,
} from "../civic-media-center/media-rail/HorizontalContentSection";
import type {
  HorizontalRailLayout,
  HorizontalSurfaceStyle,
} from "../civic-media-center/media-rail/horizontal-section.types";
import {
  MediaSemanticNode,
  type MediaSemanticOwner,
  type MediaSemanticResult,
} from "../language/media-plp/media-semantic-contract";

import { resolveHuxPreset } from "./hux-presets";
import type { HuxExperienceVariant } from "./hux.types";

import "./hux.css";

export interface HuxSectionProps<T> extends Omit<
  HorizontalContentSectionProps<T>,
  "surfaceStyle" | "layout" | "showCount" | "hideSummary" | "showScrollHint"
> {
  experience: HuxExperienceVariant;
  surfaceStyle?: HorizontalSurfaceStyle;
  layout?: HorizontalRailLayout;
  showCount?: boolean;
  hideSummary?: boolean;
  showScrollHint?: boolean;
}

export function HuxSection<T>({
  experience,
  surfaceStyle,
  layout,
  showCount,
  hideSummary,
  showScrollHint,
  className,
  viewportClassName,
  chromeSemanticOwner = "UI_DICTIONARY",
  chromeSemanticResult = "LOCALIZED_DICTIONARY",
  ...props
}: HuxSectionProps<T> & { viewportClassName?: string }) {
  const preset = resolveHuxPreset(experience, {
    surfaceStyle,
    layout,
    showCount,
    hideSummary,
    showScrollHint,
  });

  return (
    <HorizontalContentSection
      {...props}
      experience={experience}
      surfaceStyle={preset.surfaceStyle}
      layout={preset.layout}
      showCount={preset.showCount}
      hideSummary={preset.hideSummary}
      showScrollHint={preset.showScrollHint}
      className={className}
      viewportClassName={viewportClassName}
      chromeSemanticOwner={chromeSemanticOwner}
      chromeSemanticResult={chromeSemanticResult}
    />
  );
}

export function HuxDiscoverySection<T>(
  props: Omit<HuxSectionProps<T>, "experience">,
) {
  return <HuxSection experience="discovery" {...props} />;
}

export function HuxDirectorySection<T>(
  props: Omit<HuxSectionProps<T>, "experience">,
) {
  return <HuxSection experience="directory" {...props} />;
}

export function HuxWorkflowSection<T>(
  props: Omit<HuxSectionProps<T>, "experience">,
) {
  return <HuxSection experience="workflow" {...props} />;
}

export function HuxEducationSection<T>(
  props: Omit<HuxSectionProps<T>, "experience">,
) {
  return <HuxSection experience="education" {...props} />;
}

export interface HuxDirectoryShellProps {
  sectionId: string;
  eyebrow?: string;
  title: string;
  description?: string;
  headerAction?: ReactNode;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
  chromeSemanticOwner?: MediaSemanticOwner;
  chromeSemanticResult?: MediaSemanticResult;
}

function HuxChromeText(props: {
  readonly as: "p" | "h2";
  readonly className: string;
  readonly id?: string;
  readonly text: string;
  readonly owner: MediaSemanticOwner;
  readonly result: MediaSemanticResult;
}) {
  return (
    <MediaSemanticNode
      as={props.as}
      className={props.className}
      id={props.id}
      owner={props.owner}
      result={props.result}
    >
      {props.text}
    </MediaSemanticNode>
  );
}

export function HuxDirectoryShell({
  sectionId,
  eyebrow,
  title,
  description,
  headerAction,
  footer,
  className,
  children,
  chromeSemanticOwner = "UI_DICTIONARY",
  chromeSemanticResult = "LOCALIZED_DICTIONARY",
}: HuxDirectoryShellProps) {
  const headingId = `${sectionId}-heading`;

  return (
    <section
      id={sectionId}
      className={[
        "hux-section",
        "hux-section--directory",
        "horizontal-section-shell",
        "horizontal-section-shell--grouped",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-labelledby={headingId}
    >
      <div className="horizontal-section-shell__inner">
        <header className="horizontal-section-shell__header">
          <div className="horizontal-section-shell__heading-block">
            {eyebrow ? (
              <HuxChromeText
                as="p"
                className="horizontal-section-shell__eyebrow"
                text={eyebrow}
                owner={chromeSemanticOwner}
                result={chromeSemanticResult}
              />
            ) : null}
            <div className="horizontal-section-shell__title-row">
              <HuxChromeText
                as="h2"
                id={headingId}
                className="horizontal-section-shell__title"
                text={title}
                owner={chromeSemanticOwner}
                result={chromeSemanticResult}
              />
              {headerAction ? (
                <div className="horizontal-section-shell__title-actions">
                  <div className="horizontal-section-shell__header-action">{headerAction}</div>
                </div>
              ) : null}
            </div>
            {description ? (
              <HuxChromeText
                as="p"
                className="horizontal-section-shell__description"
                text={description}
                owner={chromeSemanticOwner}
                result={chromeSemanticResult}
              />
            ) : null}
          </div>
        </header>
        <div className="horizontal-section-shell__content">{children}</div>
        {footer ? <footer className="horizontal-section-shell__footer">{footer}</footer> : null}
      </div>
    </section>
  );
}

export interface HuxDiscoveryShellProps extends HuxDirectoryShellProps {
  metadata?: ReactNode;
  controls?: ReactNode;
  surfaceStyle?: "elevated" | "grouped" | "plain";
}

export function HuxDiscoveryShell({
  sectionId,
  eyebrow,
  title,
  description,
  metadata,
  headerAction,
  controls,
  footer,
  className,
  surfaceStyle = "elevated",
  children,
  chromeSemanticOwner = "UI_DICTIONARY",
  chromeSemanticResult = "LOCALIZED_DICTIONARY",
}: HuxDiscoveryShellProps) {
  const headingId = `${sectionId}-heading`;

  return (
    <section
      id={sectionId}
      className={[
        "hux-section",
        "hux-section--discovery",
        "horizontal-section-shell",
        `horizontal-section-shell--${surfaceStyle}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-labelledby={headingId}
    >
      <div className="horizontal-section-shell__inner">
        <header className="horizontal-section-shell__header">
          <div className="horizontal-section-shell__heading-block">
            {eyebrow ? (
              <HuxChromeText
                as="p"
                className="horizontal-section-shell__eyebrow"
                text={eyebrow}
                owner={chromeSemanticOwner}
                result={chromeSemanticResult}
              />
            ) : null}
            <div className="horizontal-section-shell__title-row">
              <HuxChromeText
                as="h2"
                id={headingId}
                className="horizontal-section-shell__title"
                text={title}
                owner={chromeSemanticOwner}
                result={chromeSemanticResult}
              />
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
              <HuxChromeText
                as="p"
                className="horizontal-section-shell__description"
                text={description}
                owner={chromeSemanticOwner}
                result={chromeSemanticResult}
              />
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
