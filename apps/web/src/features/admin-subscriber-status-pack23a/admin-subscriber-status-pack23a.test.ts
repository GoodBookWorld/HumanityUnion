/**
 * Pack 23A — Admin Subscribers subscription status visual states.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  blogSubscriptionStatusClassName,
  formatBlogSubscriptionStatusLabel,
} from "../administration/blog-subscription-labels.js";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(path.resolve(webSrc, relativePath), "utf8");
}

describe("Pack 23A — Admin subscriber status visual states", () => {
  it("1 — Subscribed uses success/green semantic styling", () => {
    assert.match(
      blogSubscriptionStatusClassName("subscribed"),
      /admin-publishing-table__status--active/,
    );
    const css = read("features/administration/components/admin-publishing.css");
    assert.match(
      css,
      /\.admin-publishing-table__status--active\s*\{[^}]*var\(--hu-color-success/s,
    );
    const tokens = read("design-system/tokens.css");
    assert.match(tokens, /--hu-color-success:\s*#1a6b3a/);
  });

  it("2 — Not confirmed uses warning/yellow semantic styling", () => {
    assert.match(
      blogSubscriptionStatusClassName("not_confirmed"),
      /admin-publishing-table__status--pending/,
    );
    const css = read("features/administration/components/admin-publishing.css");
    assert.match(
      css,
      /\.admin-publishing-table__status--pending\s*\{[^}]*var\(--hu-color-warning/s,
    );
    const tokens = read("design-system/tokens.css");
    assert.match(tokens, /--hu-color-warning:\s*#9a6700/);
  });

  it("3 — Unsubscribed remains neutral", () => {
    assert.match(
      blogSubscriptionStatusClassName("unsubscribed"),
      /admin-publishing-table__status--blocked/,
    );
    const css = read("features/administration/components/admin-publishing.css");
    assert.match(
      css,
      /\.admin-publishing-table__status--blocked\s*\{[^}]*var\(--hu-color-text-muted/s,
    );
    assert.doesNotMatch(
      css,
      /\.admin-publishing-table__status--blocked\s*\{[^}]*--hu-color-danger/s,
    );
  });

  it("4 — labels remain unchanged", () => {
    assert.equal(formatBlogSubscriptionStatusLabel("subscribed"), "Subscribed");
    assert.equal(formatBlogSubscriptionStatusLabel("not_confirmed"), "Not confirmed");
    assert.equal(formatBlogSubscriptionStatusLabel("unsubscribed"), "Unsubscribed");
  });

  it("5 — no status logic changes", () => {
    const labels = read("features/administration/blog-subscription-labels.ts");
    assert.match(labels, /case "subscribed"/);
    assert.match(labels, /case "not_confirmed"/);
    assert.match(labels, /case "unsubscribed"/);
    assert.match(labels, /status--active/);
    assert.match(labels, /status--pending/);
    assert.match(labels, /status--blocked/);
    const section = read("features/administration/components/AdminViewsSubscribersSection.tsx");
    assert.match(section, /blogSubscriptionStatusClassName\(row\.status\)/);
    assert.match(section, /formatBlogSubscriptionStatusLabel\(row\.status\)/);
  });

  it("6 — Subscribers table regression remains green", () => {
    const section = read("features/administration/components/AdminViewsSubscribersSection.tsx");
    assert.match(section, /Email subscription/);
    assert.match(section, /admin-publishing-table/);
    assert.match(section, /Select all subscribers on this page/);
    assert.match(section, /Remove Subscriber/);
    assert.match(section, /emailsSent/);
  });

  it("7 — mobile presentation remains valid", () => {
    const css = read("features/administration/components/admin-publishing.css");
    assert.match(css, /\.admin-publishing-table__status\s*\{[^}]*white-space:\s*nowrap/s);
    assert.match(css, /\.admin-publishing-table__status\s*\{[^}]*max-width:\s*100%/s);
    assert.match(css, /@media \(max-width:\s*720px\)/);
  });
});
