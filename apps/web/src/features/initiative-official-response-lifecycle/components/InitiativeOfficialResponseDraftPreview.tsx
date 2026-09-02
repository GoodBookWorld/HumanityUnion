"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { InitiativeOfficialResponseLifecycleDraft } from "@hu/types";

import { resolveOfficialResponseVerificationDisplayLabel } from "../../public-initiative-experience/initiative-experience-i18n";
import { getInitiativeOfficialResponseWorkspace } from "../api";

import "./initiative-official-response-stage-workspace.css";

function ListSection({ title, items }: { title: string; items: readonly string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="ior-public__section">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function InitiativeOfficialResponseDraftPreview({
  initiativeId,
}: {
  readonly initiativeId: string;
}) {
  const t = useTranslations("initiativeExperience");
  const [draft, setDraft] = useState<InitiativeOfficialResponseLifecycleDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const workspace = await getInitiativeOfficialResponseWorkspace(initiativeId);
        if (!cancelled) {
          setDraft(workspace.draft);
        }
      } catch {
        if (!cancelled) {
          setError(t("author.officialResponse.preview.loadFailed"));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initiativeId, t]);

  if (error) {
    return <p className="ior-source-panel__empty">{error}</p>;
  }

  if (!draft) {
    return <p className="ior-source-panel__empty">{t("author.officialResponse.preview.loading")}</p>;
  }

  const isNoResponse = draft.outcomeKind === "no_official_response_received";

  return (
    <article className="ior-public" aria-label={t("author.officialResponse.preview.aria")}>
      <p className="ior-public__meta">{t("author.officialResponse.preview.meta")}</p>
      <section className="ior-public__section">
        <h3>{draft.title || t("author.officialResponse.preview.untitled")}</h3>
        <p>{draft.summary}</p>
      </section>
      {isNoResponse ? (
        <section className="ior-public__section">
          <h3>{t("author.officialResponse.sections.noOfficialResponse")}</h3>
          {draft.noResponseDetail?.note?.trim() ? <p>{draft.noResponseDetail.note}</p> : null}
          <ListSection
            title={t("author.officialResponse.sections.organizationsContacted")}
            items={draft.noResponseDetail?.contactedOrganizations ?? []}
          />
          <ListSection
            title={t("author.officialResponse.sections.dates")}
            items={draft.noResponseDetail?.contactedDates ?? []}
          />
        </section>
      ) : (
        <>
          <section className="ior-public__section">
            <h3>{t("author.officialResponse.sections.receivedResponses")}</h3>
            <p className="ior-public__meta">
              {t("author.officialResponse.preview.candidatesCount", {
                count: draft.candidates.length,
              })}
            </p>
          </section>
          {draft.candidates.map((candidate, index) => (
            <section className="ior-public__section" key={candidate.candidateId}>
              <h3>
                {t("author.officialResponse.responseHeading", {
                  number: index + 1,
                  subject: candidate.subject || t("author.officialResponse.untitledResponse"),
                })}
              </h3>
              <p className="ior-public__meta">
                {t("author.officialResponse.preview.responseMeta", {
                  org:
                    candidate.institution ||
                    candidate.organization ||
                    t("author.officialResponse.preview.institutionFallback"),
                  date: candidate.receivedAt || t("author.officialResponse.preview.notSet"),
                  verification: resolveOfficialResponseVerificationDisplayLabel(
                    candidate.verificationStatus,
                    t,
                  ),
                })}
              </p>
              <p>{candidate.summary}</p>
              <ListSection
                title={t("author.officialResponse.sections.relatedActions")}
                items={candidate.relatedActions}
              />
              <ListSection
                title={t("author.officialResponse.sections.documents")}
                items={candidate.documentIds}
              />
              <ListSection title={t("author.officialResponse.sections.links")} items={candidate.links} />
            </section>
          ))}
        </>
      )}
    </article>
  );
}
