"use client";

import { useTranslations } from "next-intl";

export function MessagesLoadingFallback() {
  const t = useTranslations("workspace.messagesPage");
  return <p>{t("loading")}</p>;
}
