import { LoginForm } from "../../features/auth/components/LoginForm";

import "../../features/auth/components/auth-form.css";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <header className="auth-page__header">
        <h1 className="auth-page__title">Log in</h1>
        <p className="auth-page__subtitle">Access your Humanity Union workspace.</p>
      </header>
      <LoginForm />
    </main>
  );
}
