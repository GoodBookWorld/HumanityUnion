"use client";

import { useTranslations } from "next-intl";

import {
  PublicHomeResourceActions,
  PublicHomeResourcePrimaryButton,
  PublicHomeResourceSection,
} from "./PublicHomeResourceSection";

export function PublicHomeCivicArchiveSection() {
  const t = useTranslations("publicHome");

  return (
    <PublicHomeResourceSection
      id="public-home-archive-title"
      title={t("civicArchive.title")}
      intro={t("civicArchive.intro")}
      backgroundImage="/images/media/all-archives.webp"
      toneClass="archive"
    >
      <p className="public-home-v2__resource-copy">{t("civicArchive.copy")}</p>
      <PublicHomeResourceActions>
        <PublicHomeResourcePrimaryButton href="/civic-archive">
          {t("civicArchive.explore")}
        </PublicHomeResourcePrimaryButton>
      </PublicHomeResourceActions>
    </PublicHomeResourceSection>
  );
}
