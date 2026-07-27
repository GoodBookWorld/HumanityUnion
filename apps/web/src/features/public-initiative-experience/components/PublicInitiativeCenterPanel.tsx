"use client";

import type { RefObject, ReactNode } from "react";
import Link from "next/link";
import type {
  PublicInitiativeExperienceProjection,
  PublicInitiativeLifecycleRecordItem,
  PublicInitiativeLifecycleStageContent,
  PublicInitiativeProjection,
  PublicInitiativeRelatedCivicRecord,
} from "@hu/types";

import { formatPublicGeography } from "../../../data/geography/format-public-geography";
import { PublicDiscussionPanel } from "./PublicDiscussionPanel";

export type CenterTab = "manage" | "overview" | "related" | "discussion";

function formatList(values: string[]): string | null {
  return values.length > 0 ? values.join(", ") : null;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function OverviewSection({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) {
    return null;
  }

  return (
    <section className="pie-overview__section">
      <h3>{label}</h3>
      <p>{value}</p>
    </section>
  );
}

function OverviewMetadataItem({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) {
    return null;
  }

  return (
    <div className="pie-overview__item">
      <h3>{label}</h3>
      <p>{value}</p>
    </div>
  );
}

function PublicInitiativeOverview({ initiative }: { initiative: PublicInitiativeProjection }) {
  const metadata = initiative.metadata;
  const activityArea =
    metadata.activityArea === "Other" && metadata.activityAreaOther
      ? metadata.activityAreaOther
      : metadata.activityArea;

  return (
    <div className="pie-overview">
      <OverviewSection label="Full Description" value={initiative.description} />
      <div className="pie-overview__grid">
        <div className="pie-overview__column">
          <OverviewMetadataItem label="Activity Area" value={activityArea} />
          <OverviewMetadataItem label="Category" value={metadata.category} />
          <OverviewMetadataItem
            label="Start Date"
            value={metadata.startDate ? formatDate(metadata.startDate) : undefined}
          />
          <OverviewMetadataItem label="Author" value={initiative.stewardDisplayName} />
          <OverviewMetadataItem
            label="Current Version"
            value={`Version ${initiative.currentVersion}`}
          />
        </div>
        <div className="pie-overview__column">
          <OverviewMetadataItem
            label="Geographic Scope"
            value={formatPublicGeography({
              countryCode: metadata.countrySlug,
              regionCode: metadata.regionSlug,
              communitySlug: metadata.communitySlug,
              regionLabel: metadata.region,
              communityAssociation: metadata.communityAssociation,
            })}
          />
          <OverviewMetadataItem
            label="Community Association"
            value={metadata.communityAssociation ?? metadata.communitySlug}
          />
          <OverviewMetadataItem label="Language" value={metadata.language} />
          <OverviewMetadataItem
            label="Completion Date"
            value={metadata.completionDate ? formatDate(metadata.completionDate) : undefined}
          />
          <OverviewMetadataItem label="Status" value={initiative.status.replaceAll("_", " ")} />
          <OverviewMetadataItem label="Tags" value={formatList(metadata.tags) ?? undefined} />
        </div>
      </div>
      {initiative.sourceReferences?.map((reference) => (
        <section key={`${reference.type}-${reference.sourceRecordId}`} className="pie-overview__section">
          <h3>Source article</h3>
          <p className="pie-overview__meta">{reference.sourceName}</p>
          <p>{reference.title}</p>
          {reference.summary ? <p>{reference.summary}</p> : null}
          <p className="pie-overview__meta">Published {formatDate(reference.publishedAt)}</p>
          <p>
            <a href={reference.articleUrl} target="_blank" rel="noopener noreferrer">
              View original source
            </a>
          </p>
        </section>
      ))}
    </div>
  );
}

function LifecycleRecordCard({ record }: { record: PublicInitiativeLifecycleRecordItem }) {
  const content = (
    <>
      <h3>{record.title}</h3>
      {record.summary ? <p>{record.summary}</p> : null}
      <p className="pie-record__meta">
        {[record.status, record.authorDisplayName, record.detail].filter(Boolean).join(" · ")}
        {record.updatedAt ? ` · ${formatDate(record.updatedAt)}` : ""}
      </p>
    </>
  );

  if (record.publicHref) {
    return (
      <article className="pie-record">
        <Link href={record.publicHref}>{content}</Link>
      </article>
    );
  }

  return <article className="pie-record">{content}</article>;
}

function LifecycleStagePanel({ stage }: { stage: PublicInitiativeLifecycleStageContent }) {
  if (stage.records.length === 0) {
    return <p className="pie-empty">{stage.emptyStateMessage}</p>;
  }

  return (
    <div className="pie-stage-panel">
      {stage.records.map((record) => (
        <LifecycleRecordCard key={record.recordId} record={record} />
      ))}
    </div>
  );
}

function RelatedCivicRecords({ records }: { records: PublicInitiativeRelatedCivicRecord[] }) {
  if (records.length === 0) {
    return <p className="pie-empty">No related civic records are available.</p>;
  }

  return (
    <ul className="pie-related__list">
      {records.map((record) => (
        <li key={record.recordId}>
          <Link href={record.publicHref} className="pie-related__item">
            <span className="pie-related__type">{record.recordType}</span>
            <strong>{record.title}</strong>
            <span>
              {record.status} · {formatDate(record.updatedAt)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function DiscussionPanel({
  initiativeId,
  discussion,
}: {
  initiativeId: string;
  discussion: PublicInitiativeExperienceProjection["discussion"];
}) {
  return (
    <PublicDiscussionPanel
      initiativeId={initiativeId}
      initialComments={discussion.initialComments}
      commentCount={discussion.commentCount}
      hasMoreComments={discussion.hasMoreComments}
    />
  );
}

interface PublicInitiativeCenterPanelProps {
  experience: PublicInitiativeExperienceProjection;
  activeTab: CenterTab;
  activeStageId: string;
  showLifecyclePanel: boolean;
  onTabChange: (tab: CenterTab) => void;
  contentRef: RefObject<HTMLDivElement | null>;
  showManageTab?: boolean;
  managePanel?: ReactNode;
}

export function PublicInitiativeCenterPanel({
  experience,
  activeTab,
  activeStageId,
  showLifecyclePanel,
  onTabChange,
  contentRef,
  showManageTab = false,
  managePanel = null,
}: PublicInitiativeCenterPanelProps) {
  const activeStage = experience.stageContent.find((stage) => stage.stageId === activeStageId);
  const tabs: Array<[CenterTab, string]> = showManageTab
    ? [
        ["manage", "Manage"],
        ["overview", "Overview"],
        ["related", "Related Civic Records"],
        ["discussion", "Discussion"],
      ]
    : [
        ["overview", "Overview"],
        ["related", "Related Civic Records"],
        ["discussion", "Discussion"],
      ];

  return (
    <div className="pie-center">
      <div className="pie-center__tabs" role="tablist" aria-label="Initiative content">
        {tabs.map(([tabId, label]) => (
          <button
            key={tabId}
            type="button"
            role="tab"
            id={`pie-tab-${tabId}`}
            aria-selected={activeTab === tabId && !showLifecyclePanel}
            aria-controls={`pie-panel-${tabId}`}
            className={`pie-center__tab${activeTab === tabId && !showLifecyclePanel ? " pie-center__tab--active" : ""}`}
            onClick={() => onTabChange(tabId)}
          >
            {label}
          </button>
        ))}
      </div>

      <div ref={contentRef} className="pie-center__content">
        {showLifecyclePanel && activeStage ? (
          <section
            className="pie-center__panel"
            aria-labelledby={`pie-stage-${activeStage.stageId}`}
          >
            <h2 id={`pie-stage-${activeStage.stageId}`}>
              {experience.lifecycleStages.find((stage) => stage.stageId === activeStage.stageId)
                ?.label ?? "Lifecycle"}
            </h2>
            <LifecycleStagePanel stage={activeStage} />
          </section>
        ) : null}

        {!showLifecyclePanel && showManageTab && activeTab === "manage" ? (
          <section
            id="pie-panel-manage"
            role="tabpanel"
            aria-labelledby="pie-tab-manage"
            className="pie-center__panel pie-center__panel--manage"
          >
            {managePanel}
          </section>
        ) : null}

        {!showLifecyclePanel && activeTab === "overview" ? (
          <section
            id="pie-panel-overview"
            role="tabpanel"
            aria-labelledby="pie-tab-overview"
            className="pie-center__panel"
          >
            <PublicInitiativeOverview initiative={experience.initiative} />
          </section>
        ) : null}

        {!showLifecyclePanel && activeTab === "related" ? (
          <section
            id="pie-panel-related"
            role="tabpanel"
            aria-labelledby="pie-tab-related"
            className="pie-center__panel"
          >
            <RelatedCivicRecords records={experience.relatedCivicRecords} />
          </section>
        ) : null}

        {!showLifecyclePanel && activeTab === "discussion" ? (
          <section
            id="pie-panel-discussion"
            role="tabpanel"
            aria-labelledby="pie-tab-discussion"
            className="pie-center__panel"
          >
            <DiscussionPanel
              initiativeId={experience.initiativeId}
              discussion={experience.discussion}
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}
