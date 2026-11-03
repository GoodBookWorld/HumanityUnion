"use client";

import { formatSeoHealthPercent } from "../admin-seo-overview-model";

import "./admin-seo-overview.css";

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export type SeoRadialTone = "good" | "fair" | "poor" | "none";

/** ≥ 90 % good, ≥ 60 % fair, otherwise poor; no arc and no tone without data. */
export function resolveSeoRadialTone(percent: number | null): SeoRadialTone {
  if (percent === null) {
    return "none";
  }
  if (percent >= 90) {
    return "good";
  }
  return percent >= 60 ? "fair" : "poor";
}

interface AdminSeoRadialIndicatorProps {
  label: string;
  percent: number | null;
  size: "large" | "compact";
  caption?: string;
  /** Renders the indicator as a button (e.g. opens the Diagnostics tab). */
  onSelect?: () => void;
}

/**
 * SEO-11B.1 — pure SVG radial indicator. The SVG is decorative; the value, label
 * and caption are real text, so a button is named by what it shows.
 */
export function AdminSeoRadialIndicator({
  label,
  percent,
  size,
  caption,
  onSelect,
}: AdminSeoRadialIndicatorProps) {
  const value = formatSeoHealthPercent(percent);
  const tone = resolveSeoRadialTone(percent);
  const clamped = percent === null ? 0 : Math.min(100, Math.max(0, percent));
  const className = `admin-seo-radial admin-seo-radial--${size} admin-seo-radial--${tone}`;

  const content = (
    <>
      <span className="admin-seo-radial__ring">
        <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
          <circle className="admin-seo-radial__track" cx="60" cy="60" r={RADIUS} />
          {percent === null ? null : (
            <circle
              className="admin-seo-radial__progress"
              cx="60"
              cy="60"
              r={RADIUS}
              strokeDasharray={`${(CIRCUMFERENCE * clamped) / 100} ${CIRCUMFERENCE}`}
              transform="rotate(-90 60 60)"
            />
          )}
        </svg>
        <span className="admin-seo-radial__value">{value}</span>
      </span>
      <span className="admin-seo-radial__label">{label}</span>
      {caption ? <span className="admin-seo-radial__caption">{caption}</span> : null}
    </>
  );

  if (onSelect) {
    return (
      <button type="button" className={`${className} admin-seo-radial--action`} onClick={onSelect}>
        {content}
      </button>
    );
  }

  return (
    <div
      className={className}
      role="img"
      aria-label={caption ? `${label}: ${value}. ${caption}` : `${label}: ${value}`}
    >
      {content}
    </div>
  );
}
