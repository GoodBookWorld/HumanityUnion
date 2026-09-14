import { getTranslations } from "next-intl/server";

import { RegisterForm } from "../../features/auth/components/RegisterForm";

import "../../features/auth/components/auth-form.css";

export default async function RegisterPage() {
  const t = await getTranslations("auth");

  return (
    <main className="auth-page">
      <header className="auth-page__header">
        <h1 className="auth-page__title">{t("registerTitle")}</h1>
        <p className="auth-page__subtitle">{t("registerSubtitle")}</p>
      </header>
      <RegisterForm />
    </main>
  );
}
