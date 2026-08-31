import { getTranslations } from "next-intl/server";

import { LoginForm } from "../../features/auth/components/LoginForm";

import "../../features/auth/components/auth-form.css";

export default async function LoginPage() {
  const t = await getTranslations("auth");

  return (
    <main className="auth-page">
      <header className="auth-page__header">
        <h1 className="auth-page__title">{t("loginTitle")}</h1>
        <p className="auth-page__subtitle">{t("loginSubtitle")}</p>
      </header>
      <LoginForm />
    </main>
  );
}
