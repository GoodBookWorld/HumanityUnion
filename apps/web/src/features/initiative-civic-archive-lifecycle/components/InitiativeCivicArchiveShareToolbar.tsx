"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("initiativeExperience");
  const [status, setStatus] = useState<string | null>(null);
  const sharePath = getCivicArchivePublicSharePath(initiativeId);
  const published = mode === "published";

  async function handleShare() {
    if (!published) {
      setStatus(t("author.archive.share.shareAfterPublish"));
      return;
    }

    const absoluteUrl =
      typeof window !== "undefined" ? `${window.location.origin}${sharePath}` : sharePath;

    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({
          title: t("author.archive.share.shareTitle"),
          url: absoluteUrl,
        });
        setStatus(t("author.archive.share.shared"));
        return;
      }

      await navigator.clipboard.writeText(absoluteUrl);
      setStatus(t("author.archive.share.linkCopied"));
    } catch {
      setStatus(t("author.archive.share.shareFailed"));
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
    <div
      className="ica-toolbar"
      aria-label={`${t("author.archive.share.share")} / ${t("author.archive.share.downloadLifecycle")}`}
    >
      <WorkspaceButton variant="secondary" onClick={() => void handleShare()} disabled={!published}>
        {published ? t("author.archive.share.shareArchive") : t("author.archive.share.share")}
      </WorkspaceButton>
      <WorkspaceButton variant="secondary" onClick={handleDownload}>
        {published
          ? t("author.archive.share.downloadLifecycle")
          : t("author.archive.share.downloadDraftPreview")}
      </WorkspaceButton>
      {status ? <p className="ica-source-panel__empty">{status}</p> : null}
    </div>
  );
}
