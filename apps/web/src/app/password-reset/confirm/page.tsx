import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";

import { PasswordResetConfirmForm } from "../../../features/auth/components/PasswordResetConfirmForm";
import { resolveBrandForMetadata } from "../../../features/brand-localization/resolve-brand-for-metadata";

import "../../../features/auth/components/auth-form.css";

export default async function PasswordResetConfirmPage() {
  const locale = await getLocale();
  const brand = await resolveBrandForMetadata(locale);
  const t = await getTranslations("auth");

  return (
    <main className="auth-page">
      <header className="auth-page__header">
        <h1 className="auth-page__title">{t("chooseNewPasswordTitle")}</h1>
        <p className="auth-page__subtitle">
          {t("chooseNewPasswordSubtitle", { siteName: brand.siteName })}
        </p>
      </header>
      <Suspense fallback={<p>{t("loadingResetForm")}</p>}>
        <PasswordResetConfirmForm />
      </Suspense>
    </main>
  );
}
