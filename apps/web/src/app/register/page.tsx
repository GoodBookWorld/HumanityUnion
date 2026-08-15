import { RegisterForm } from "../../features/auth/components/RegisterForm";

import "../../features/auth/components/auth-form.css";

export default function RegisterPage() {
  return (
    <main className="auth-page">
      <header className="auth-page__header">
        <h1 className="auth-page__title">Create account</h1>
        <p className="auth-page__subtitle">Create your Humanity Union Participant account.</p>
      </header>
      <RegisterForm />
    </main>
  );
}
