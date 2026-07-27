import { LoginVerifyForm } from "../../../features/auth/components/LoginVerifyForm";

import "../../../features/auth/components/auth-form.css";

export default function LoginVerifyPage() {
  return (
    <main className="auth-page">
      <header className="auth-page__header">
        <h1 className="auth-page__title">Verify Login</h1>
        <p className="auth-page__subtitle">
          Complete Two-Step Login with the email code we sent to your confirmed address.
        </p>
      </header>
      <LoginVerifyForm />
    </main>
  );
}
