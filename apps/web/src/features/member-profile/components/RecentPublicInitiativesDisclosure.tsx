"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { useTranslations } from "next-intl";

import type { MemberProfilePublicRecentInitiative } from "@hu/types";

/**
 * Pack 17F — white Pack-17A 3D disclosure for Recent Public Initiatives.
 * Lists only initiatives already on the public projection (server-filtered).
 */
export function RecentPublicInitiativesDisclosure({
  initiatives,
}: {
  initiatives: readonly MemberProfilePublicRecentInitiative[];
}) {
  const t = useTranslations("participantPublic");
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const count = initiatives.length;
  const recentInitiativesLabel = t("sections.recentInitiatives");

  return (
    <section
      className="public-member-page__initiatives"
      aria-label={recentInitiativesLabel}
    >
      <button
        type="button"
        className="hu-tab-control public-member-page__initiatives-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        <img
          className="public-member-page__heading-icon"
          src="/icons/workspace/publications.png"
          alt=""
          aria-hidden="true"
          width={24}
          height={24}
        />
        <span className="public-member-page__initiatives-toggle-label">
          {recentInitiativesLabel}
        </span>
        {count > 0 ? (
          <span className="public-member-page__initiatives-count">{count}</span>
        ) : null}
      </button>

      <div
        id={panelId}
        className={
          open
            ? "public-member-page__initiatives-panel is-open"
            : "public-member-page__initiatives-panel"
        }
        hidden={!open}
      >
        <ul
          className="public-member-page__initiatives-list"
          aria-label={recentInitiativesLabel}
        >
          {initiatives.map((initiative) => (
            <li key={initiative.initiativeId} className="public-member-page__initiatives-item">
              <Link href={initiative.href}>{initiative.title}</Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
