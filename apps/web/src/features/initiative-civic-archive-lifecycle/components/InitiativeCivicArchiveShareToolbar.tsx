"use client";

import { useState } from "react";

import { WorkspaceButton } from "../../initiative-workspace-ux";
import {
  getCivicArchivePublicSharePath,
  getDraftCivicArchivePdfUrl,
  getPublishedCivicArchivePdfUrl,
} from "../api";

interface InitiativeCivicArchiveShareToolbarProps {
  readonly initiativeId: string;
  readonly mode: "published" | "preview";
}

/**
 * Share / Download toolbar for Civic Archive. Published: copy public deep
 * link + download PDF. Preview: optional draft PDF; share disabled until
 * publication.
 */
export function InitiativeCivicArchiveShareToolbar({
  initiativeId,
  mode,
}: InitiativeCivicArchiveShareToolbarProps) {
  const [status, setStatus] = useState<string | null>(null);
  const sharePath = getCivicArchivePublicSharePath(initiativeId);
  const published = mode === "published";

  async function handleShare() {
    if (!published) {
      setStatus("Share is available after publication.");
      return;
    }

    const absoluteUrl =
      typeof window !== "undefined" ? `${window.location.origin}${sharePath}` : sharePath;

    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({
          title: "Civic Archive",
          url: absoluteUrl,
        });
        setStatus("Shared.");
        return;
      }

      await navigator.clipboard.writeText(absoluteUrl);
      setStatus("Archive link copied.");
    } catch {
      setStatus("Could not share or copy the Archive link.");
    }
  }

  function handleDownload() {
    if (published) {
      window.open(getPublishedCivicArchivePdfUrl(initiativeId), "_blank", "noopener,noreferrer");
      return;
    }

    window.open(getDraftCivicArchivePdfUrl(initiativeId), "_blank", "noopener,noreferrer");
  }

  return (
    <div className="ica-toolbar" aria-label="Civic Archive share and download">
      <WorkspaceButton variant="secondary" onClick={() => void handleShare()} disabled={!published}>
        {published ? "Share Archive" : "Share (after publication)"}
      </WorkspaceButton>
      <WorkspaceButton variant="secondary" onClick={handleDownload}>
        {published ? "Download Lifecycle" : "Download Draft Preview"}
      </WorkspaceButton>
      {status ? <p className="ica-source-panel__empty">{status}</p> : null}
    </div>
  );
}
