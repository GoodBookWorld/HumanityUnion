"use client";

import { useEffect, useState } from "react";

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
    return <p className="lsw-result__placeholder">This draft could not be loaded.</p>;
  }

  if (loading) {
    return <p className="lsw-result__placeholder">Loading draft…</p>;
  }

  const draft = context?.draft ?? null;

  if (!draft) {
    return (
      <p className="lsw-result__placeholder">
        There is no Petition draft yet — generate one, then Preview again.
      </p>
    );
  }

  return (
    <div className="ipl-public-result" translate="yes">
      <div className="ipl-public-result__field">
        <h4>Petition Title</h4>
        <LifecycleTranslatableText>{draft.title || "Untitled"}</LifecycleTranslatableText>
      </div>

      <div className="ipl-public-result__field">
        <h4>Public Summary</h4>
        <LifecycleTranslatableText>
          {draft.publicSummary || "No summary provided yet."}
        </LifecycleTranslatableText>
      </div>

      <div className="ipl-public-result__field">
        <h4>Request Statement</h4>
        <LifecycleTranslatableText>
          {draft.requestStatement || "No request statement provided yet."}
        </LifecycleTranslatableText>
      </div>

      <div className="ipl-public-result__field">
        <h4>Expected Outcome</h4>
        <LifecycleTranslatableText>
          {draft.expectedOutcome || "No expected outcome provided yet."}
        </LifecycleTranslatableText>
      </div>

      <div className="ipl-public-result__field">
        <h4>Supporting Context</h4>
        <LifecycleTranslatableText>
          {draft.supportingContext || "No supporting context provided yet."}
        </LifecycleTranslatableText>
      </div>

      <div className="ipl-public-result__field">
        <h4>Key Arguments</h4>
        {draft.keyArguments.length > 0 ? (
          <ul className="ipl-public-result__key-arguments" translate="yes">
            {draft.keyArguments.map((argument, index) => (
              <li key={index}>{argument}</li>
            ))}
          </ul>
        ) : (
          <LifecycleTranslatableText className="ipl-public-result__empty">
            No key arguments drafted yet.
          </LifecycleTranslatableText>
        )}
      </div>

      <section className="ipl-support" aria-label="Representative signatures preview">
        <p className="ipl-support__title">Representative Signatures</p>
        <p className="ipl-support__note">
          0 Participants · 0 Members · 0 Visitors — signing unlocks for visitors once this Petition is
          published and opened.
        </p>
      </section>
    </div>
  );
}
