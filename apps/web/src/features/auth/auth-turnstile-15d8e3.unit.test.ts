/**
 * STEP 15D.8E.3 — Auth iOS input zoom + Turnstile client contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel: string): string {
  return readFileSync(path.join(webSrc, rel), "utf8");
}

describe("STEP 15D.8E.3 — Auth focus zoom + Turnstile UI", () => {
  it("auth interactive inputs use >=16px (1rem base), labels stay sm", () => {
    const css = read("features/auth/components/auth-form.css");
    assert.match(css, /\.auth-form__field\s*\{[\s\S]*?font-size:\s*var\(--hu-font-size-sm\)/);
    assert.match(
      css,
      /\.humanity-app \.auth-form__field input[\s\S]*?font-size:\s*var\(--hu-font-size-base\)/,
    );
    const tokens = read("design-system/tokens.css");
    assert.match(tokens, /--hu-font-size-base:\s*1rem/);
    assert.match(tokens, /--hu-font-size-sm:\s*0\.875rem/);
  });

  it("viewport metadata does not disable pinch zoom", () => {
    const layout = read("app/layout.tsx");
    assert.match(layout, /width:\s*"device-width"/);
    assert.match(layout, /initialScale:\s*1/);
    assert.match(layout, /viewportFit:\s*"cover"/);
    assert.doesNotMatch(layout, /maximumScale:\s*1/);
    assert.doesNotMatch(layout, /userScalable:\s*false/);
    assert.doesNotMatch(layout, /user-scalable=no/);
    assert.doesNotMatch(layout, /maximum-scale=1/);
  });

  it("no viewport scale / reload / resize / visualViewport hacks in auth", () => {
    const login = read("features/auth/components/LoginForm.tsx");
    const register = read("features/auth/components/RegisterForm.tsx");
    const css = read("features/auth/components/auth-form.css");
    for (const src of [login, register, css]) {
      assert.doesNotMatch(src, /visualViewport/);
      assert.doesNotMatch(src, /location\.reload/);
      assert.doesNotMatch(src, /setTimeout\([^)]*zoom|scale/i);
      assert.doesNotMatch(src, /maximum-scale|user-scalable/);
    }
  });

  it("Login and Register render Turnstile and gate submit on token", () => {
    const login = read("features/auth/components/LoginForm.tsx");
    const register = read("features/auth/components/RegisterForm.tsx");
    const api = read("features/auth/auth-api.ts");
    for (const src of [login, register]) {
      assert.match(src, /TurnstileWidget/);
      assert.match(src, /turnstileToken/);
      assert.match(src, /size="flexible"/);
      assert.match(src, /canSubmit/);
      assert.match(src, /resetTurnstile/);
      assert.match(src, /if \(submitting\)/);
    }
    assert.match(api, /turnstileToken:\s*string/);
    assert.match(login, /auth-login-turnstile/);
    assert.match(register, /auth-register-turnstile/);
  });

  it("token cleared before request and reset after failure", () => {
    const login = read("features/auth/components/LoginForm.tsx");
    const register = read("features/auth/components/RegisterForm.tsx");
    for (const src of [login, register]) {
      assert.match(src, /setTurnstileToken\(null\)/);
      assert.match(src, /catch[\s\S]*?resetTurnstile\(\)/);
    }
  });

  it("auth Turnstile host is shrink-safe; Blog keeps shared widget without secret", () => {
    const authCss = read("features/auth/components/auth-form.css");
    const widget = read("features/security/turnstile/TurnstileWidget.tsx");
    const widgetCss = read("features/security/turnstile/turnstile-widget.css");
    const blog = read("features/blog/components/BlogSubscriptionForm.tsx");
    assert.match(authCss, /\.auth-form__turnstile\s*\{[\s\S]*?max-width:\s*100%/);
    assert.match(authCss, /\.auth-form__turnstile\s*\{[\s\S]*?min-width:\s*0/);
    assert.match(widgetCss, /\.hu-turnstile\s*\{[\s\S]*?max-width:\s*100%/);
    assert.match(widget, /NEXT_PUBLIC_TURNSTILE_SITE_KEY/);
    assert.doesNotMatch(widget, /TURNSTILE_SECRET_KEY/);
    assert.match(blog, /TurnstileWidget/);
    assert.match(blog, /size="normal"/);
  });

  it("auth page shell remains viewport-bounded (320/390 contract)", () => {
    const css = read("features/auth/components/auth-form.css");
    assert.match(css, /\.auth-page\s*\{[\s\S]*?width:\s*min\(100%,\s*var\(--hu-form-max-width\)\)/);
    assert.match(css, /\.auth-page\s*\{[\s\S]*?box-sizing:\s*border-box/);
    assert.doesNotMatch(css, /overflow-x:\s*hidden/);
    assert.doesNotMatch(css, /\[lang=/);
    assert.doesNotMatch(css, /:lang\(/);
  });

  it("workspace PWA width regression suite still present", () => {
    const suite = read("features/workspace-home/workspace-pwa-root-width-15d8e1.unit.test.ts");
    assert.match(suite, /15D\.8E\.1/);
    assert.match(suite, /display-mode/);
    assert.match(suite, /humanity-layout/);
  });
});
