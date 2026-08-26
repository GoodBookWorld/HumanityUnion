/**
 * Pack 21A — Blog public subscription UI contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(path.resolve(webSrc, relativePath), "utf8");
}

describe("Pack 21A — Blog subscription UI", () => {
  it("Blog header renders email field and Subscribe button", () => {
    const index = read("features/blog/components/BlogIndexPageContent.tsx");
    assert.match(index, /BlogSubscriptionForm/);
    assert.match(index, /blog-page__header-copy/);

    const form = read("features/blog/components/BlogSubscriptionForm.tsx");
    assert.match(form, /type="email"/);
    assert.match(form, /Subscribe/);
    assert.match(form, /requestPublicBlogSubscription/);
    assert.match(form, /Check your email|result\.message/);
  });

  it("Blog subscribe form has responsive header structure", () => {
    const css = read("features/blog/blog.css");
    assert.match(css, /\.blog-page__header\s*\{[^}]*flex-direction:\s*column/s);
    assert.match(css, /@media \(min-width:\s*900px\)\s*\{[^}]*\.blog-page__header\s*\{[^}]*flex-direction:\s*row/s);
    assert.match(css, /\.blog-subscribe__row/);
  });

  it("confirm and unsubscribe pages exist without requiring Participant login", () => {
    const confirm = read("app/blog/subscribe/confirm/page.tsx");
    const unsub = read("app/blog/subscribe/unsubscribe/page.tsx");
    assert.match(confirm, /BlogSubscriptionConfirmPageContent/);
    assert.match(unsub, /BlogSubscriptionUnsubscribePageContent/);
    assert.doesNotMatch(confirm, /AdminAccessGate|requireAuthentication|WorkspaceAuthGate/);
    assert.doesNotMatch(unsub, /AdminAccessGate|requireAuthentication|WorkspaceAuthGate/);
  });

  it("client API uses public subscription endpoints", () => {
    const api = read("features/blog/blog-subscription-api.ts");
    assert.match(api, /\/api\/v1\/public\/blog\/subscriptions/);
    assert.match(api, /\/subscriptions\/confirm/);
    assert.match(api, /\/subscriptions\/unsubscribe/);
  });
});
