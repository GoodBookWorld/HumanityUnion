import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";

import { VerifyEmailPanel } from "../../features/auth/components/VerifyEmailPanel";
import { resolveBrandForMetadata } from "../../features/brand-localization/resolve-brand-for-metadata";

import "../../features/auth/components/auth-form.css";

export default async function VerifyEmailPage() {
  const locale = await getLocale();
  const brand = await resolveBrandForMetadata(locale);
  const t = await getTranslations("auth");

  return (
    <main className="auth-page">
      <header className="auth-page__header">
        <h1 className="auth-page__title">{t("verifyEmailTitle")}</h1>
        <p className="auth-page__subtitle">{t("verifyEmailSubtitle", { siteName: brand.siteName })}</p>
      </header>
      <Suspense fallback={<p>{t("loadingVerification")}</p>}>
        <VerifyEmailPanel />
      </Suspense>
    </main>
  );
}
