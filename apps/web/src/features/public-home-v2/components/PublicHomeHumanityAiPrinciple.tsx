"use client";

import { useTranslations } from "next-intl";

/**
 * Branded Humanity AI principle — sits below the Hero, above the next-section divider.
 * Always client-rendered for locale catalogs; CSS hides on mobile while keeping DOM text for SEO.
 */
export function PublicHomeHumanityAiPrinciple() {
  const t = useTranslations("publicHome");

  return (
    <p className="public-home-v2__humanity-ai-principle">{t("humanityAiPrinciple")}</p>
  );
}
