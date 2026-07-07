import Link from "next/link";

import type { CivicBreadcrumbItem, CivicPipelineStatus, RelatedRecord } from "@hu/types";

import "./capability02-integration.css";

export function CivicBreadcrumb({ items }: { items: CivicBreadcrumbItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav className="capability02-integration__breadcrumb" aria-label="Civic path">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`}>
          {index > 0 ? (
            <span className="capability02-integration__breadcrumb-separator">→</span>
          ) : null}
          {item.href ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function CivicPipelineStatusPanel({ status }: { status: CivicPipelineStatus }) {
  return (
    <div className="capability02-integration__panel">
      <h3 className="capability02-integration__heading">Civic Pipeline Status</h3>
      <div className="capability02-integration__pipeline">
        {status.stages.map((stage) => (
          <div key={stage.id} className="capability02-integration__pipeline-item">
            <span className="capability02-integration__pipeline-marker">
              {stage.complete ? "✔" : "○"}
            </span>
            <span>{stage.label}</span>
          </div>
        ))}
      </div>
      {status.nextAvailableStep ? (
        <p className="capability02-integration__meta">
          Next civic stage: {status.nextAvailableStep}
        </p>
      ) : null}
    </div>
  );
}

export function RelatedCivicRecordsPanel({ records }: { records: RelatedRecord[] }) {
  if (records.length === 0) {
    return null;
  }

  return (
    <div className="capability02-integration__panel">
      <h3 className="capability02-integration__heading">Related Civic Records</h3>
      <ul className="capability02-integration__list">
        {records.map((record) => (
          <li key={`${record.entityType}-${record.entityId}`}>
            <Link href={record.publicUrl}>{record.title}</Link>
            <p className="capability02-integration__meta">
              {record.relationshipType.replace(/_/g, " ")} · {record.summary}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CivicContextPanel({
  title,
  summary,
  sections,
}: {
  title: string;
  summary: string;
  sections: Array<{ id: string; title: string; records: RelatedRecord[] }>;
}) {
  if (sections.length === 0) {
    return null;
  }

  return (
    <div className="capability02-integration__panel">
      <h3 className="capability02-integration__heading">Civic Context</h3>
      <p className="capability02-integration__meta">
        {title} — {summary}
      </p>
      {sections.map((section) => (
        <div key={section.id} className="capability02-integration__section">
          <p className="capability02-integration__section-title">{section.title}</p>
          <ul className="capability02-integration__list">
            {section.records.map((record) => (
              <li key={`${section.id}-${record.entityId}`}>
                <Link href={record.publicUrl}>{record.title}</Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
