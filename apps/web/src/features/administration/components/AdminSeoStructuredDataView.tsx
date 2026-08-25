"use client";

import Link from "next/link";

import { ProfileSection } from "../../../components/member/ProfileSection";
import {
  buildStructuredDataTypeCoverage,
  formatSeoCapabilityLabel,
} from "../admin-seo-console-model";

import "./admin-seo-diagnostics.css";
import "./admin-seo-console.css";

export function AdminSeoStructuredDataView() {
  const coverage = buildStructuredDataTypeCoverage();

  return (
    <div className="admin-seo-console__panel">
      <ProfileSection title="Structured Data coverage">
        <p className="hu-caption admin-seo-console__lede">
          Automatic Pack 04 schema coverage. No JSON-LD editor — schemas are generated from public
          page data.
        </p>
        <ul className="admin-seo-diagnostics__grid">
          {coverage.map((entry) => (
            <li key={entry.id}>
              <article
                className={`admin-seo-diagnostics__card admin-seo-diagnostics__card--${entry.status}`}
                aria-label={`${entry.schemaType} — ${formatSeoCapabilityLabel(entry.status)}`}
              >
                <header className="admin-seo-diagnostics__card-header">
                  <h3 className="admin-seo-diagnostics__card-title">{entry.schemaType}</h3>
                  <span
                    className={`admin-seo-diagnostics__badge admin-seo-diagnostics__badge--${entry.status}`}
                  >
                    {formatSeoCapabilityLabel(entry.status)}
                  </span>
                </header>
                <p className="admin-seo-diagnostics__card-summary">{entry.summary}</p>
                <p className="hu-caption admin-seo-diagnostics__card-detail">
                  Surfaces: {entry.surfaces.join(", ")}
                </p>
              </article>
            </li>
          ))}
        </ul>
        <p className="hu-caption admin-seo-diagnostics__note">
          Root WebSite + Organization render in{" "}
          <Link className="admin-panel__link" href="/">
            the public home layout
          </Link>
          . Entity schemas render on their public pages.
        </p>
      </ProfileSection>
    </div>
  );
}
