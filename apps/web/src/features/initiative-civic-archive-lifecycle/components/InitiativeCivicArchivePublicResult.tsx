"use client";

import { useEffect, useState } from "react";

import type { InitiativeLifecycleArchiveDocument } from "@hu/types";

import { getPublishedInitiativeCivicArchive } from "../api";
import { InitiativeCivicArchiveDocumentRenderer } from "./InitiativeCivicArchiveDocumentRenderer";
import { InitiativeCivicArchiveShareToolbar } from "./InitiativeCivicArchiveShareToolbar";

import "./initiative-civic-archive-stage-workspace.css";

interface InitiativeCivicArchivePublicResultProps {
  readonly initiativeId: string;
  readonly isPreview?: boolean;
}

/**
 * Initiative Lifecycle — Part M. Read-only published Archive Document for
 * every viewer. Editing happens only via a new Generate → Publish cycle that
 * creates the next immutable version.
 */
export function InitiativeCivicArchivePublicResult({
  initiativeId,
  isPreview = false,
}: InitiativeCivicArchivePublicResultProps) {
  const [document, setDocument] = useState<InitiativeLifecycleArchiveDocument | null | undefined>(
    undefined,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await getPublishedInitiativeCivicArchive(initiativeId);
        if (!cancelled) {
          setDocument(result?.document ?? null);
        }
      } catch {
        if (!cancelled) {
          setError("Published Civic Archive could not be loaded.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initiativeId]);

  if (error) {
    return <p className="ica-source-panel__empty">{error}</p>;
  }

  if (document === undefined) {
    return <p className="ica-source-panel__empty">Loading published Civic Archive…</p>;
  }

  if (!document) {
    return <p className="ica-source-panel__empty">No Civic Archive published yet.</p>;
  }

  return (
    <>
      <InitiativeCivicArchiveShareToolbar initiativeId={initiativeId} mode="published" />
      <InitiativeCivicArchiveDocumentRenderer
        document={document}
        metaLabel={isPreview ? "Author Preview of published Civic Archive" : undefined}
      />
    </>
  );
}
