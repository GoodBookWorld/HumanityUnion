"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { InitiativePetitionDraftContext } from "@hu/types";

import { LifecycleTranslatableText } from "../../initiative-lifecycle-stage-workspace/components/LifecycleTranslatableText";
import { getInitiativePetitionWorkspace } from "../api";

import "./initiative-petition-stage-workspace.css";

/**
 * Initiative Lifecycle — Part F, Section 6 (Preview).
 *
 * "Preview uses the same renderer as Public ... only difference: Preview
 * displays the current draft ... no duplicate renderer." Renders the
 * Author's own current (unpublished) Petition draft, self-fetched the
 * same way `InitiativePetitionAuthorWorkspace` already does — mirrors
 * `InitiativeRevisionDraftPreview` (Part E).
 *
 * Once a Petition has actually been published, Preview renders
 * `InitiativePetitionPublicResult` instead (see `PublicInitiativeCenterPanel`)
 * — this component only covers the "nothing published yet" gap.
 */
export function InitiativePetitionDraftPreview({ initiativeId }: { readonly initiativeId: string }) {
  const t = useTranslations("initiativeExperience");
  const [context, setContext] = useState<InitiativePetitionDraftContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadFailed(false);

    getInitiativePetitionWorkspace(initiativeId)
      .then((result) => {
        if (!cancelled) {
          setContext(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initiativeId]);

  if (loadFailed) {
    return <p className="lsw-result__placeholder">{t("author.petition.preview.loadFailed")}</p>;
  }

  if (loading) {
    return <p className="lsw-result__placeholder">{t("author.petition.preview.loading")}</p>;
  }

  const draft = context?.draft ?? null;

  if (!draft) {
    return (
      <p className="lsw-result__placeholder">
        {t("author.petition.preview.empty")}
      </p>
    );
  }

  return (
    <div className="ipl-public-result" translate="yes">
      <div className="ipl-public-result__field">
        <h4>{t("author.petition.fields.title")}</h4>
        {draft.title ? (
          <LifecycleTranslatableText>{draft.title}</LifecycleTranslatableText>
        ) : (
          <p className="ipl-public-result__empty">{t("author.petition.preview.untitled")}</p>
        )}
      </div>

      <div className="ipl-public-result__field">
        <h4>{t("author.petition.fields.publicSummary")}</h4>
        {draft.publicSummary ? (
          <LifecycleTranslatableText>{draft.publicSummary}</LifecycleTranslatableText>
        ) : (
          <p className="ipl-public-result__empty">{t("author.petition.preview.emptySummary")}</p>
        )}
      </div>

      <div className="ipl-public-result__field">
        <h4>{t("author.petition.fields.requestStatement")}</h4>
        {draft.requestStatement ? (
          <LifecycleTranslatableText>{draft.requestStatement}</LifecycleTranslatableText>
        ) : (
          <p className="ipl-public-result__empty">{t("author.petition.preview.emptyRequest")}</p>
        )}
      </div>

      <div className="ipl-public-result__field">
        <h4>{t("author.petition.fields.expectedOutcome")}</h4>
        {draft.expectedOutcome ? (
          <LifecycleTranslatableText>{draft.expectedOutcome}</LifecycleTranslatableText>
        ) : (
          <p className="ipl-public-result__empty">{t("author.petition.preview.emptyOutcome")}</p>
        )}
      </div>

      <div className="ipl-public-result__field">
        <h4>{t("author.petition.fields.supportingContext")}</h4>
        {draft.supportingContext ? (
          <LifecycleTranslatableText>{draft.supportingContext}</LifecycleTranslatableText>
        ) : (
          <p className="ipl-public-result__empty">{t("author.petition.preview.emptyContext")}</p>
        )}
      </div>

      <div className="ipl-public-result__field">
        <h4>{t("author.petition.fields.keyArguments")}</h4>
        {draft.keyArguments.length > 0 ? (
          <ul className="ipl-public-result__key-arguments" translate="yes">
            {draft.keyArguments.map((argument, index) => (
              <li key={index}>{argument}</li>
            ))}
          </ul>
        ) : (
          <p className="ipl-public-result__empty">
            {t("author.petition.preview.emptyKeyArguments")}
          </p>
        )}
      </div>

      <section
        className="ipl-support"
        aria-label={t("author.petition.preview.signaturesAria")}
      >
        <p className="ipl-support__title">{t("author.petition.preview.signaturesTitle")}</p>
        <p className="ipl-support__note">{t("author.petition.preview.signaturesNote")}</p>
      </section>
    </div>
  );
}
