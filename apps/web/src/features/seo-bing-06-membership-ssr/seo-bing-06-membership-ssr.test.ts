/**
 * SEO-BING-06 — while auth is pending (server render and first client render),
 * Membership shows only content every visitor sees: the public shell, hero and
 * public sections. Sign-in controls and member cards wait for auth to resolve.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";

import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import { MembershipPageContent } from "../membership/components/MembershipPageContent.js";

(globalThis as { React?: typeof React }).React = React;

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");
const CONTENT = readFileSync(
  path.join(webSrc, "features/membership/components/MembershipPageContent.tsx"),
  "utf8",
);

const PUBLIC_SECTIONS = [
  "membership-meaning-title",
  "membership-not-means-title",
  "membership-benefits-title",
  "membership-faq-title",
];
const MEMBER_ONLY_SECTIONS = [
  "membership-status-title",
  "membership-journey-title",
  "membership-application-title",
  "membership-contribution-title",
  "membership-sign-in-title",
];

async function renderPending(locale: string) {
  const loaded = await loadUiMessagesForLocale(locale);
  const html = renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      {
        locale,
        messages: loaded.messages,
        timeZone: "UTC",
      } as React.ComponentProps<typeof NextIntlClientProvider>,
      createElement(MembershipPageContent),
    ),
  );
  const messages = loaded.messages as unknown as {
    membershipPublic: { pageTitle: string; loading: string };
  };
  return { html, messages: messages.membershipPublic };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

describe("SEO-BING-06 — Membership pending-auth server render", () => {
  for (const locale of ["en", "uk"]) {
    it(`1. ${locale}: public shell, hero, loading slot and four public sections`, async () => {
      const { html, messages } = await renderPending(locale);

      assert.ok(
        html.includes(
          `<h1 class="membership-page-shell__title">${escapeHtml(messages.pageTitle)}</h1>`,
        ),
      );
      assert.match(html, /class="membership-page-shell__subtitle"/);
      assert.match(
        html,
        /<section class="membership-hero" aria-labelledby="membership-hero-title">/,
      );
      assert.ok(html.includes(escapeHtml(messages.loading)), "existing loading state in auth slot");
      for (const id of PUBLIC_SECTIONS) {
        assert.ok(html.includes(`aria-labelledby="${id}"`), id);
      }
    });

    it(`2. ${locale}: no sign-in controls or member-specific content`, async () => {
      const { html } = await renderPending(locale);

      assert.equal(/href="\/(login|register)/.test(html), false);
      for (const id of MEMBER_ONLY_SECTIONS) {
        assert.equal(html.includes(id), false, id);
      }
      assert.equal(html.includes("member-workspace"), false);
    });
  }

  it("3. pending branch reuses existing pieces; resolved branches are unchanged", () => {
    const pending = CONTENT.slice(
      CONTENT.indexOf('if (authStatus === "pending") {'),
      CONTENT.indexOf(
        'if (authStatus === "authenticated") {\n    return (\n      <MemberWorkspace',
      ),
    );
    assert.match(pending, /<MembershipHero \/>/);
    assert.match(pending, /<LoadingState message=\{t\("loading"\)\} \/>/);
    assert.match(pending, /<MembershipPublicSections \/>/);
    assert.equal(/MembershipSignInPrompt|MembershipPageBody|MemberWorkspace/.test(pending), false);

    assert.match(CONTENT, /<MembershipPageBody authStatus="authenticated" \/>/);
    assert.match(CONTENT, /<MembershipPageBody authStatus="unauthenticated" \/>/);
    assert.match(CONTENT, /<MembershipSignInPrompt \/>/);
  });
});
