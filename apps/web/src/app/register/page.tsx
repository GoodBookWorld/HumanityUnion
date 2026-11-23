import { getLocale, getTranslations } from "next-intl/server";

import { RegisterForm } from "../../features/auth/components/RegisterForm";
import { resolveBrandForMetadata } from "../../features/brand-localization/resolve-brand-for-metadata";

import "../../features/auth/components/auth-form.css";

export default async function RegisterPage() {
  const locale = await getLocale();
  const brand = await resolveBrandForMetadata(locale);
  const t = await getTranslations("auth");

  return (
    <main className="auth-page">
      <header className="auth-page__header">
        <h1 className="auth-page__title">{t("registerTitle")}</h1>
        <p className="auth-page__subtitle">{t("registerSubtitle", { siteName: brand.siteName })}</p>
      </header>
      <RegisterForm />
    </main>
  );
}
