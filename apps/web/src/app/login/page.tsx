import { getLocale, getTranslations } from "next-intl/server";

import { LoginForm } from "../../features/auth/components/LoginForm";
import { resolveBrandForMetadata } from "../../features/brand-localization/resolve-brand-for-metadata";

import "../../features/auth/components/auth-form.css";

export default async function LoginPage() {
  const locale = await getLocale();
  const brand = await resolveBrandForMetadata(locale);
  const t = await getTranslations("auth");

  return (
    <main className="auth-page">
      <header className="auth-page__header">
        <h1 className="auth-page__title">{t("loginTitle")}</h1>
        <p className="auth-page__subtitle">{t("loginSubtitle", { siteName: brand.siteName })}</p>
      </header>
      <LoginForm />
    </main>
  );
}
