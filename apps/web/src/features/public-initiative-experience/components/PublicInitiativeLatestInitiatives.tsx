"use client";

import Link from "next/link";

import type { WorldInitiativeCardProjection } from "@hu/types";

import { InitiativeImage } from "../../initiatives/components/InitiativeImage";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function PublicInitiativeLatestInitiatives({
  initiatives,
}: {
  initiatives: WorldInitiativeCardProjection[];
}) {
  if (initiatives.length === 0) {
    return null;
  }

  return (
    <section className="pie-latest" aria-labelledby="pie-latest-title">
      <h2 id="pie-latest-title">Latest Initiatives</h2>
      <ul className="pie-latest__list">
        {initiatives.map((initiative) => (
          <li key={initiative.initiativeId}>
            <Link href={initiative.publicInitiativeHref} className="pie-latest__card">
              <div className="pie-latest__thumb">
                <InitiativeImage title={initiative.title} imageUrl={initiative.imageUrl} />
              </div>
              <div className="pie-latest__body">
                <h3>{initiative.title}</h3>
                <p>{initiative.activityArea}</p>
                <p className="pie-latest__date">{formatDate(initiative.publishedAt)}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
