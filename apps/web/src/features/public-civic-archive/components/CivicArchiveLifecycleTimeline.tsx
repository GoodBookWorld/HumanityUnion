"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import type { CivicArchiveLifecycleRecord } from "@hu/types";

import "./civic-archive-lifecycle-timeline.css";

interface CivicArchiveLifecycleTimelineProps {
  record: CivicArchiveLifecycleRecord;
}

export function CivicArchiveLifecycleTimeline({ record }: CivicArchiveLifecycleTimelineProps) {
  const t = useTranslations("initiativeExperience.civicArchivePublic.lifecycle");
  const locale = useLocale();

  return (
    <section className="civic-archive-lifecycle" aria-labelledby="civic-archive-lifecycle-title">
      <h2 id="civic-archive-lifecycle-title">{t("title")}</h2>
      <ol className="civic-archive-lifecycle__timeline">
        {record.stages.map((stage) => (
          <li key={stage.stageId} className="civic-archive-lifecycle__stage">
            <h3>{stage.label}</h3>
            <ul>
              {stage.records.map((child) => (
                <li
                  key={`${child.entityType}-${child.entityId}`}
                  className="civic-archive-lifecycle__record"
                >
                  <h4>{child.title}</h4>
                  <p>{child.summary}</p>
                  <p className="civic-archive-lifecycle__record-meta">
                    {child.status} · {new Date(child.updatedAt).toLocaleDateString(locale)}
                  </p>
                  <Link href={child.publicUrl}>{t("viewRecord")}</Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}
