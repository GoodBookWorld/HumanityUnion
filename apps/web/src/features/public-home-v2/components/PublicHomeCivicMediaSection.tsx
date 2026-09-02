"use client";

import { useTranslations } from "next-intl";

import { CIVIC_MEDIA_ROUTE } from "../../civic-media-center/routes";
import {
  PublicHomeResourceActions,
  PublicHomeResourcePrimaryButton,
  PublicHomeResourceSecondaryButton,
  PublicHomeResourceSection,
} from "./PublicHomeResourceSection";

export function PublicHomeCivicMediaSection() {
  const t = useTranslations("publicHome");

  return (
    <PublicHomeResourceSection
      id="public-home-civic-media-title"
      title={t("civicMedia.title")}
      intro={t("civicMedia.intro")}
      backgroundImage="/images/media/all-media.webp"
      toneClass="media"
    >
      <p className="public-home-v2__resource-copy">{t("civicMedia.copy")}</p>
      <PublicHomeResourceActions>
        <PublicHomeResourcePrimaryButton href={CIVIC_MEDIA_ROUTE}>
          {t("civicMedia.explore")}
        </PublicHomeResourcePrimaryButton>
        <PublicHomeResourceSecondaryButton href="/initiatives">
          {t("civicMedia.createFromConcern")}
        </PublicHomeResourceSecondaryButton>
      </PublicHomeResourceActions>
    </PublicHomeResourceSection>
  );
}
