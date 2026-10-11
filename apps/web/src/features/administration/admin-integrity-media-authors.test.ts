import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import React, { createElement } from "react";

(globalThis as { React?: typeof React }).React = React;
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";

import { ADMIN_PANEL_SECTIONS, resolveAdminPanelSectionId } from "./admin-panel-sections";
import {
  buildAdminIntegrityMediaAuthorsPath,
  buildIntegrityMediaAuthorMessageRequest,
  integrityMediaAuthorDeliveryCopy,
  integrityMediaAuthorsNextOffset,
  integrityMediaAuthorsPreviousOffset,
  integrityMediaAuthorsQueryAfterFilter,
  interpretIntegrityMediaAuthorDelivery,
  validateIntegrityMediaAuthorMessageForm,
  type IntegrityMediaAuthorRow,
} from "./admin-integrity-media-authors-model";
import {
  AdminIntegrityAuthorDeliveryNotice,
  AdminIntegrityAuthorSendButton,
} from "./components/AdminIntegrityAuthorMessageDialog";
import { AdminIntegrityAuthorsPanel } from "./components/AdminIntegrityAuthorsPanel";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(path.resolve(webSrc, relativePath), "utf8");
}

function row(overrides: Partial<IntegrityMediaAuthorRow> = {}): IntegrityMediaAuthorRow {
  return {
    memberId: "22222222-2222-4222-8222-222222222222",
    externalAuthorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    state: "linked",
    authorActivationPending: false,
    canSend: true,
    createdAt: "2026-03-03T00:00:00.000Z",
    confirmedAt: "2026-03-03T00:00:00.000Z",
    disconnectedAt: null,
    participantDisplayName: "Ada Lovelace",
    participantProfileHref:
      "/admin/participants/22222222-2222-4222-8222-222222222222/public-profile",
    messageCount: 1,
    latestMessage: {
      messageId: "33333333-3333-4333-8333-333333333333",
      title: "Connection test",
      status: "delivered",
      lastErrorCode: null,
      createdAt: "2026-03-03T02:00:00.000Z",
      deliveredAt: "2026-03-03T02:00:00.000Z",
    },
    ...overrides,
  };
}

function renderPanel(
  overrides: Partial<Parameters<typeof AdminIntegrityAuthorsPanel>[0]> = {},
): string {
  return renderToStaticMarkup(
    createElement(AdminIntegrityAuthorsPanel, {
      phase: "ready",
      authors: [row()],
      state: "all",
      offset: 0,
      total: 1,
      hasMore: false,
      onStateChange: () => undefined,
      onPrevious: () => undefined,
      onNext: () => undefined,
      onSend: () => undefined,
      ...overrides,
    }),
  );
}

describe("Integrity Authors admin", () => {
  it("adds Integrity Media after Publishing at /admin/integrity-media", () => {
    const labels = ADMIN_PANEL_SECTIONS.map((section) => section.label);
    const publishing = labels.indexOf("Publishing");
    assert.equal(labels[publishing + 1], "Integrity Media");
    assert.equal(ADMIN_PANEL_SECTIONS[publishing + 1]?.href, "/admin/integrity-media");
    assert.equal(resolveAdminPanelSectionId("/admin/integrity-media"), "integrity-media");
    assert.doesNotMatch(
      read("features/administration/components/AdminIntegrityAuthorsSection.tsx"),
      /AdminViewsNavigation/,
    );
  });

  it("uses the existing admin gate and layout", () => {
    const page = read("app/admin/integrity-media/page.tsx");
    assert.match(page, /AdminAccessGate/);
    assert.match(page, /AdminIntegrityAuthorsSection/);
    const section = read("features/administration/components/AdminIntegrityAuthorsSection.tsx");
    assert.match(section, /AdminPanelNavigation/);
    assert.match(section, /ProfileSection title="Integrity Authors"/);
    assert.match(read("app/admin/layout.tsx"), /WorkspaceAuthGate/);
    assert.match(read("app/admin/layout.tsx"), /MemberWorkspace/);
  });

  it("renders loading, empty, and error states", () => {
    assert.match(renderPanel({ phase: "loading", authors: [] }), /Loading Integrity Authors/);
    assert.match(
      renderPanel({ phase: "ready", authors: [], total: 0 }),
      /No Integrity Media authors match this filter/,
    );
    const error = renderPanel({
      phase: "error",
      authors: [],
      errorMessage: "Integrity authors could not be loaded.",
    });
    assert.match(error, /Integrity Authors unavailable/);
    assert.match(error, /could not be loaded/);
  });

  it("keeps linked, disabled, and setup-pending rows visible", () => {
    const html = renderPanel({
      total: 3,
      authors: [
        row(),
        row({
          memberId: "55555555-5555-4555-8555-555555555555",
          state: "linked",
          authorActivationPending: true,
          canSend: false,
          participantDisplayName: "Pending Author",
          participantProfileHref: undefined,
          latestMessage: null,
          messageCount: 0,
        }),
        row({
          memberId: "44444444-4444-4444-8444-444444444444",
          state: "disabled",
          canSend: false,
          participantDisplayName: "Former Author",
          disconnectedAt: "2026-03-04T00:00:00.000Z",
          latestMessage: null,
          messageCount: 0,
        }),
      ],
    });
    assert.match(html, /Ada Lovelace/);
    assert.match(html, /Humanity Union Participant/);
    assert.match(html, /Pending Author/);
    assert.match(html, /Setup pending/);
    assert.match(html, /Former Author/);
    assert.match(html, /Disabled/);
    assert.equal((html.match(/Send Message/g) ?? []).length, 1);
    assert.match(html, /Send unavailable/);
    assert.match(html, /href="\/admin\/publishing"/);
    assert.doesNotMatch(html, /plain-body-marker|ctaUrl|@example\.com/);
  });

  it("resets offset when the connection filter changes and paginates with hasMore", () => {
    assert.deepEqual(integrityMediaAuthorsQueryAfterFilter("disabled"), {
      state: "disabled",
      offset: 0,
      limit: 25,
    });
    assert.equal(
      buildAdminIntegrityMediaAuthorsPath(integrityMediaAuthorsQueryAfterFilter("setup_pending")),
      "/api/v1/admin/integrity-media/authors?state=setup_pending&limit=25&offset=0",
    );
    assert.equal(integrityMediaAuthorsNextOffset(0, 25, true), 25);
    assert.equal(integrityMediaAuthorsNextOffset(0, 25, false), null);
    assert.equal(integrityMediaAuthorsPreviousOffset(25, 25), 0);
    assert.equal(integrityMediaAuthorsPreviousOffset(0, 25), null);

    const html = renderPanel({ offset: 0, hasMore: false, total: 1 });
    assert.match(html, /disabled=""/);
    const section = read("features/administration/components/AdminIntegrityAuthorsSection.tsx");
    assert.match(section, /integrityMediaAuthorsQueryAfterFilter/);
    assert.match(section, /integrityMediaAuthorsNextOffset/);
    assert.match(section, /void loadAuthors\(\)/);
  });

  it("posts only title, body, and optional CTA", () => {
    const plain = buildIntegrityMediaAuthorMessageRequest({
      title: " Hello ",
      body: " Body ",
      ctaLabel: " ",
      ctaUrl: "",
    });
    assert.deepEqual(plain, { title: "Hello", body: "Body" });
    assert.equal("externalAuthorId" in plain, false);
    assert.equal("messageId" in plain, false);
    assert.equal("status" in plain, false);

    const withCta = buildIntegrityMediaAuthorMessageRequest({
      title: "Hello",
      body: "Body",
      ctaLabel: "Read",
      ctaUrl: "https://example.com/read",
    });
    assert.deepEqual(Object.keys(withCta).sort(), ["body", "cta", "title"]);
    assert.equal("externalAuthorId" in withCta, false);

    const api = read("features/administration/admin-integrity-media-authors-api.ts");
    assert.match(api, /JSON\.stringify\(input\)/);
    assert.doesNotMatch(api, /externalAuthorId|hmac|signature/);
  });

  it("blocks a second submit while a send is in flight", () => {
    const html = renderToStaticMarkup(
      createElement(AdminIntegrityAuthorSendButton, { submitting: true }),
    );
    assert.match(html, /disabled/);
    assert.match(html, /Sending…/);
    const dialog = read("features/administration/components/AdminIntegrityAuthorMessageDialog.tsx");
    assert.match(dialog, /if \(submittingRef\.current\)/);
    assert.match(dialog, /submittingRef\.current = true/);
  });

  it("renders delivered, pending, failed, and unknown delivery states", () => {
    assert.equal(interpretIntegrityMediaAuthorDelivery("delivered").ok, true);
    assert.equal(interpretIntegrityMediaAuthorDelivery("pending").ok, true);
    assert.equal(interpretIntegrityMediaAuthorDelivery("failed").ok, true);
    assert.equal(interpretIntegrityMediaAuthorDelivery(undefined).ok, false);
    assert.equal(interpretIntegrityMediaAuthorDelivery("accepted").ok, false);

    const delivered = renderToStaticMarkup(
      createElement(AdminIntegrityAuthorDeliveryNotice, { status: "delivered" }),
    );
    const pending = renderToStaticMarkup(
      createElement(AdminIntegrityAuthorDeliveryNotice, { status: "pending" }),
    );
    const failed = renderToStaticMarkup(
      createElement(AdminIntegrityAuthorDeliveryNotice, { status: "failed" }),
    );
    const unknown = renderToStaticMarkup(
      createElement(AdminIntegrityAuthorDeliveryNotice, { status: "unknown" }),
    );
    assert.match(delivered, /Delivered/);
    assert.match(delivered, /Integrity Media accepted this message/);
    assert.match(pending, /Pending/);
    assert.match(pending, /still in progress/);
    assert.doesNotMatch(pending, /Delivered/);
    assert.match(failed, /Failed/);
    assert.match(failed, /was not delivered/);
    assert.match(unknown, /Delivery status unavailable/);
    assert.equal(integrityMediaAuthorDeliveryCopy("pending").title, "Pending");
  });

  it("validates title, body, and paired CTA before send", () => {
    assert.equal(
      validateIntegrityMediaAuthorMessageForm({
        title: "",
        body: "Hello",
        ctaLabel: "",
        ctaUrl: "",
      })?.title,
      "Title is required.",
    );
    assert.ok(
      validateIntegrityMediaAuthorMessageForm({
        title: "Hello",
        body: "<b>no</b>",
        ctaLabel: "",
        ctaUrl: "",
      })?.body,
    );
    assert.ok(
      validateIntegrityMediaAuthorMessageForm({
        title: "Hello",
        body: "Body",
        ctaLabel: "Read",
        ctaUrl: "",
      })?.ctaUrl,
    );
    assert.ok(
      validateIntegrityMediaAuthorMessageForm({
        title: "Hello",
        body: "Body",
        ctaLabel: "Read",
        ctaUrl: "javascript:alert(1)",
      })?.ctaUrl,
    );
    assert.equal(
      validateIntegrityMediaAuthorMessageForm({
        title: "Hello",
        body: "Body",
        ctaLabel: "",
        ctaUrl: "",
      }),
      null,
    );
  });

  it("keeps dialog focus behavior aligned with the badge-order dialog", () => {
    const dialog = read("features/administration/components/AdminIntegrityAuthorMessageDialog.tsx");
    const badge = read("features/administration/components/AdminMemberBadgeOrderModal.tsx");
    assert.match(dialog, /role="dialog"/);
    assert.match(dialog, /aria-modal="true"/);
    assert.match(dialog, /trapTabKey/);
    assert.match(dialog, /event\.key === "Escape"/);
    assert.match(dialog, /previouslyFocusedRef/);
    assert.match(dialog, /focusable\?\.focus\(\)/);
    assert.match(badge, /trapTabKey/);
    assert.match(dialog, /onRefresh\(\)/);
    assert.match(dialog, /interpretIntegrityMediaAuthorDelivery/);
  });

  it("IM-HU.04C.2D.3 — splits the dialog into a scrollable body and a pinned action footer", () => {
    const dialog = read("features/administration/components/AdminIntegrityAuthorMessageDialog.tsx");
    // Header (title/description) stays outside the scroll region.
    assert.match(dialog, /<header className="admin-integrity-author-message-dialog__header">/);
    // Fields and the delivery-result banner live inside the scrollable body,
    // not as direct children of the dialog, so they can never push the
    // footer off-screen.
    assert.match(dialog, /<div className="admin-integrity-author-message-dialog__body">/);
    const bodyOpenIndex = dialog.indexOf(
      '<div className="admin-integrity-author-message-dialog__body">',
    );
    const bodyCloseIndex = dialog.indexOf("</div>", bodyOpenIndex);
    const actionsIndex = dialog.indexOf(
      '<div className="admin-integrity-author-message-dialog__actions">',
    );
    assert.ok(bodyOpenIndex > -1 && bodyCloseIndex > bodyOpenIndex);
    assert.ok(actionsIndex > bodyCloseIndex, "actions footer must follow the closed body region");
    const resultBannerIndex = dialog.indexOf("<StatusBanner title={resultTitle}");
    assert.ok(
      resultBannerIndex > bodyOpenIndex && resultBannerIndex < bodyCloseIndex,
      "the delivery result banner must render inside the scrollable body, not after it",
    );
    // Close/Send remain reachable in a footer that never scrolls away.
    assert.match(dialog, /<div className="admin-integrity-author-message-dialog__actions">/);
  });

  it("IM-HU.04C.2D.3 — bounds the dialog to the viewport instead of a fixed desktop height", () => {
    const css = read(
      "features/administration/components/admin-integrity-author-message-dialog.css",
    );
    assert.doesNotMatch(css, /height:\s*\d+px/);
    assert.match(css, /\.admin-integrity-author-message-dialog\s*\{[^}]*max-height:\s*calc\(100dvh/);
    assert.match(css, /\.admin-integrity-author-message-dialog\s*\{[^}]*overflow:\s*hidden/);
    assert.match(
      css,
      /\.admin-integrity-author-message-dialog__body\s*\{[^}]*overflow-y:\s*auto/,
    );
    assert.match(
      css,
      /\.admin-integrity-author-message-dialog__body\s*\{[^}]*min-height:\s*0/,
    );
    assert.match(
      css,
      /\.admin-integrity-author-message-dialog__actions\s*\{[^}]*flex:\s*0 0 auto/,
    );
    assert.match(css, /@media \(max-width: 640px\)/);
  });
});
