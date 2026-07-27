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
            {eyebrow ? <p className="horizontal-section-shell__eyebrow">{eyebrow}</p> : null}
            <div className="horizontal-section-shell__title-row">
              <h2 id={headingId} className="horizontal-section-shell__title">
                {title}
              </h2>
              {headerAction ? (
                <div className="horizontal-section-shell__title-actions">
                  <div className="horizontal-section-shell__header-action">{headerAction}</div>
                </div>
              ) : null}
            </div>
            {description ? (
              <p className="horizontal-section-shell__description">{description}</p>
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
            {eyebrow ? <p className="horizontal-section-shell__eyebrow">{eyebrow}</p> : null}
            <div className="horizontal-section-shell__title-row">
              <h2 id={headingId} className="horizontal-section-shell__title">
                {title}
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
