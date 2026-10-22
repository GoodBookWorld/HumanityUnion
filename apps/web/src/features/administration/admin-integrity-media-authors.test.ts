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
  INTEGRITY_MEDIA_AUTHOR_HISTORY_PAGE_SIZE,
  buildAdminIntegrityMediaAuthorHistoryPath,
  buildAdminIntegrityMediaAuthorsPath,
  buildIntegrityMediaAuthorChatRequest,
  buildIntegrityMediaAuthorMessageRequest,
  integrityMediaAuthorComposeBlockedCopy,
  integrityMediaAuthorDeliveryCopy,
  integrityMediaAuthorLatestStatusLabel,
  integrityMediaAuthorLatestTitle,
  integrityMediaAuthorSafeError,
  integrityMediaAuthorsNextOffset,
  integrityMediaAuthorsPreviousOffset,
  integrityMediaAuthorsQueryAfterFilter,
  interpretIntegrityMediaAuthorDelivery,
  mergeIntegrityMediaAuthorHistory,
  restoredTranscriptScrollTop,
  inboundIntegrityMediaAuthorChatIds,
  authorNotificationOpenRequest,
  buildAdminIntegrityMediaAuthorReadPath,
  buildAdminIntegrityMediaAuthorReplyTargetPath,
  findIntegrityMediaAuthorDirectoryRow,
  integrityMediaAuthorDirectoryHref,
  isIntegrityMediaAuthorReplyMessageId,
  selectIntegrityMediaAuthorByMemberId,
  validateIntegrityMediaAuthorChatForm,
  validateIntegrityMediaAuthorMessageForm,
  type IntegrityMediaAuthorHistoryMessage,
  type IntegrityMediaAuthorRow,
} from "./admin-integrity-media-authors-model";
import {
  AdminIntegrityAuthorDeliveryNotice,
  AdminIntegrityAuthorHistoryMessage,
  AdminIntegrityAuthorMessageDialog,
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
    collaborationStatus: "active",
    canSend: true,
    createdAt: "2026-03-03T00:00:00.000Z",
    confirmedAt: "2026-03-03T00:00:00.000Z",
    disconnectedAt: null,
    participantDisplayName: "Ada Lovelace",
    participantProfileHref:
      "/admin/participants/22222222-2222-4222-8222-222222222222/public-profile",
    messageCount: 1,
    unreadCount: 0,
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

describe("Integrity author notification chat", () => {
  const ada = "22222222-2222-4222-8222-222222222222";
  const grace = "55555555-5555-4555-8555-555555555555";
  const replyId = "11111111-1111-4111-8111-111111111111";

  it("selects the member id when two authors share a display name", async () => {
    const authors = [
      row({ memberId: ada, participantDisplayName: "Ada Lovelace" }),
      row({ memberId: grace, participantDisplayName: "Ada Lovelace" }),
    ];
    assert.equal(selectIntegrityMediaAuthorByMemberId(authors, grace)?.memberId, grace);
    assert.equal(selectIntegrityMediaAuthorByMemberId(authors, ada)?.memberId, ada);
    assert.equal(selectIntegrityMediaAuthorByMemberId(authors, "77777777-7777-4777-8777-777777777777"), null);

    const pages: number[] = [];
    const found = await findIntegrityMediaAuthorDirectoryRow(grace, async (query) => {
      assert.equal(query.state, "all");
      pages.push(query.offset);
      if (query.offset === 0) {
        return { authors: authors.slice(0, 1), hasMore: true };
      }
      return { authors: authors.slice(1), hasMore: false };
    });
    assert.deepEqual(pages, [0, 1]);
    assert.equal(found?.memberId, grace);
    assert.equal(found?.participantDisplayName, "Ada Lovelace");
  });

  it("opens a direct reply link once and stays quiet while that id is current", () => {
    assert.equal(isIntegrityMediaAuthorReplyMessageId(replyId), true);
    assert.equal(isIntegrityMediaAuthorReplyMessageId("not-a-message"), false);
    assert.equal(authorNotificationOpenRequest(null, null), null);
    assert.equal(authorNotificationOpenRequest("not-a-message", null), null);
    assert.equal(authorNotificationOpenRequest(replyId, null), replyId);
    assert.equal(authorNotificationOpenRequest(replyId, replyId), null);
    assert.equal(
      buildAdminIntegrityMediaAuthorReplyTargetPath(replyId),
      `/api/v1/admin/integrity-media/authors/reply-target?messageId=${replyId}`,
    );
  });

  it("removes only messageId so the same notification can reopen", () => {
    assert.equal(
      integrityMediaAuthorDirectoryHref(
        "/admin/integrity-media",
        `messageId=${replyId}&view=unread`,
      ),
      "/admin/integrity-media?view=unread",
    );
    assert.equal(
      integrityMediaAuthorDirectoryHref("/admin/integrity-media", `messageId=${replyId}`),
      "/admin/integrity-media",
    );
    assert.equal(authorNotificationOpenRequest(replyId, null), replyId);
  });

  it("keeps Chat and History on the directory and opens the dialog from the reply link", () => {
    const html = renderPanel({
      authors: [
        row({ memberId: ada, participantDisplayName: "Ada Lovelace" }),
        row({ memberId: grace, participantDisplayName: "Ada Lovelace" }),
      ],
      total: 2,
    });
    assert.equal((html.match(/Open chat with Ada Lovelace/g) ?? []).length, 2);
    const section = read("features/administration/components/AdminIntegrityAuthorsSection.tsx");
    assert.match(section, /useSearchParams/);
    assert.match(section, /resolveAdminIntegrityMediaAuthorReply/);
    assert.match(section, /onSend=\{setSendTarget\}/);
    assert.match(section, /integrityMediaAuthorDirectoryHref/);
    assert.match(section, /authorNotificationOpenRequest/);
    assert.doesNotMatch(section, /markAdminIntegrityMediaAuthorMessagesRead/);
    const header = read("features/administration/components/AdminWorkspaceHeader.tsx");
    assert.match(header, /async function handleClear/);
    assert.match(header, /resolveAdminNotificationHref\(notification\)/);
  });
});

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
    assert.equal((html.match(/Chat/g) ?? []).length, 1);
    assert.equal((html.match(/History/g) ?? []).length, 2);
    assert.doesNotMatch(html, /Send unavailable/);
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
    assert.equal((dialog.match(/if \(submittingRef\.current \|\| !canSend\)/g) ?? []).length, 2);
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

  it("IM-HU.04C.2D.3 — splits the dialog into a scrollable transcript and a pinned composer", () => {
    const dialog = read("features/administration/components/AdminIntegrityAuthorMessageDialog.tsx");
    assert.match(dialog, /<header className="admin-integrity-author-message-dialog__header">/);
    assert.match(dialog, /className="admin-integrity-author-message-dialog__transcript"/);
    const transcriptIndex = dialog.indexOf('className="admin-integrity-author-message-dialog__transcript"');
    const footerIndex = dialog.indexOf(
      '<footer className="admin-integrity-author-message-dialog__footer">',
    );
    const composerIndex = dialog.indexOf(
      'className="admin-integrity-author-message-dialog__composer"',
    );
    const actionsIndex = dialog.indexOf(
      '<div className="admin-integrity-author-message-dialog__actions">',
    );
    assert.ok(transcriptIndex > -1 && footerIndex > transcriptIndex);
    assert.ok(composerIndex > footerIndex, "the chat composer stays in the pinned footer");
    assert.ok(actionsIndex > composerIndex, "chat actions stay with the composer");
    assert.match(dialog, /System notification/);
    assert.match(dialog, /sendAdminIntegrityMediaAuthorMessage/);
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
      /\.admin-integrity-author-message-dialog__transcript\s*\{[^}]*overflow-y:\s*auto/,
    );
    assert.match(
      css,
      /\.admin-integrity-author-message-dialog__transcript\s*\{[^}]*min-height:\s*0/,
    );
    assert.match(
      css,
      /\.admin-integrity-author-message-dialog__footer\s*\{[^}]*flex:\s*0 0 auto/,
    );
    assert.match(
      css,
      /\.admin-integrity-author-message-dialog__composer\s*\{[^}]*flex:\s*0 0 auto/,
    );
    assert.match(
      css,
      /\.admin-integrity-author-message-dialog__actions\s*\{[^}]*flex:\s*0 0 auto/,
    );
    assert.match(css, /@media \(max-width: 640px\)/);
  });

  it("loads the latest 20 messages and older pages through the existing cursor", () => {
    assert.equal(INTEGRITY_MEDIA_AUTHOR_HISTORY_PAGE_SIZE, 20);
    const memberId = "22222222-2222-4222-8222-222222222222";
    assert.equal(
      buildAdminIntegrityMediaAuthorHistoryPath(memberId, { limit: 20 }),
      `/api/v1/admin/integrity-media/authors/${memberId}/messages?limit=20`,
    );
    assert.equal(
      buildAdminIntegrityMediaAuthorHistoryPath(memberId, { limit: 20, cursor: "cursor+1" }),
      `/api/v1/admin/integrity-media/authors/${memberId}/messages?limit=20&cursor=cursor%2B1`,
    );
    const dialog = read("features/administration/components/AdminIntegrityAuthorMessageDialog.tsx");
    const api = read("features/administration/admin-integrity-media-authors-api.ts");
    assert.match(dialog, /limit: INTEGRITY_MEDIA_AUTHOR_HISTORY_PAGE_SIZE/);
    assert.match(dialog, /cursor: nextCursor/);
    assert.match(dialog, /mergeIntegrityMediaAuthorHistory\(page\.messages, current\)/);
    assert.match(dialog, /restoredTranscriptScrollTop/);
    assert.match(api, /buildAdminIntegrityMediaAuthorHistoryPath/);
    assert.doesNotMatch(api, /externalAuthorId|hmac|signature/);
  });

  it("prepends older history in chronological order without duplicates", () => {
    const older = [
      historyMessage({ messageId: "m-1", createdAt: "2026-03-01T00:00:00.000Z", body: "First" }),
      historyMessage({ messageId: "m-2", createdAt: "2026-03-02T00:00:00.000Z", body: "Second" }),
    ];
    const current = [
      historyMessage({ messageId: "m-2", createdAt: "2026-03-02T00:00:00.000Z", body: "Second" }),
      historyMessage({ messageId: "m-3", createdAt: "2026-03-03T00:00:00.000Z", body: "Third" }),
    ];
    const merged = mergeIntegrityMediaAuthorHistory(older, current);
    assert.deepEqual(
      merged.map((message) => message.messageId),
      ["m-1", "m-2", "m-3"],
    );
    assert.equal(merged.length, 3);
  });

  it("shows both directions and Chat versus System without a blank chat title", () => {
    const html = renderToStaticMarkup(
      createElement(
        "div",
        null,
        createElement(AdminIntegrityAuthorHistoryMessage, {
          participantDisplayName: "Ada Lovelace",
          message: historyMessage({
            direction: "hu_to_im",
            kind: "system",
            title: "Connection test",
            body: "System body",
            delivery: {
              status: "delivered",
              deliveredAt: "2026-03-03T02:00:00.000Z",
              attemptCount: 1,
              lastErrorCode: null,
            },
          }),
        }),
        createElement(AdminIntegrityAuthorHistoryMessage, {
          participantDisplayName: "Ada Lovelace",
          message: historyMessage({
            messageId: "44444444-4444-4444-8444-444444444444",
            direction: "im_to_hu",
            kind: "chat",
            title: "",
            body: "Reply body",
            createdAt: "2026-03-03T03:00:00.000Z",
            delivery: {
              status: "recorded",
              deliveredAt: null,
              attemptCount: 0,
              lastErrorCode: null,
            },
          }),
        }),
        createElement(AdminIntegrityAuthorHistoryMessage, {
          participantDisplayName: "Ada Lovelace",
          message: historyMessage({
            messageId: "55555555-5555-4555-8555-555555555555",
            direction: "hu_to_im",
            kind: "chat",
            title: "   ",
            body: "Untitled chat",
            delivery: null,
          }),
        }),
      ),
    );
    assert.match(html, /Humanity Union/);
    assert.match(html, /Ada Lovelace/);
    assert.match(html, /System/);
    assert.match(html, /Chat/);
    assert.match(html, /Connection test/);
    assert.match(html, /System body/);
    assert.match(html, /Reply body/);
    assert.match(html, /Untitled chat/);
    assert.match(html, /Delivered/);
    assert.match(html, /Recorded/);
    assert.doesNotMatch(html, /Failed/);
    assert.equal((html.match(/admin-integrity-author-message-dialog__message-title/g) ?? []).length, 1);
  });

  it("sends chat as body only and keeps the notification request", () => {
    const chat = buildIntegrityMediaAuthorChatRequest("  Hello from admin  ");
    assert.deepEqual(chat, { body: "Hello from admin" });
    assert.deepEqual(Object.keys(chat), ["body"]);
    assert.equal(validateIntegrityMediaAuthorChatForm("   "), "Message is required.");
    assert.equal(validateIntegrityMediaAuthorChatForm("<b>no</b>"), "Message must be plain text.");
    assert.match(
      validateIntegrityMediaAuthorChatForm("x".repeat(8001)) ?? "",
      /8000 characters or fewer/,
    );
    assert.equal(validateIntegrityMediaAuthorChatForm("Hello"), null);

    const dialog = read("features/administration/components/AdminIntegrityAuthorMessageDialog.tsx");
    const api = read("features/administration/admin-integrity-media-authors-api.ts");
    assert.match(dialog, /buildIntegrityMediaAuthorChatRequest\(chatBody\)/);
    assert.match(dialog, /sendAdminIntegrityMediaAuthorChat\(memberId, payload\)/);
    assert.match(dialog, /sendAdminIntegrityMediaAuthorMessage\(memberId, payload\)/);
    assert.match(api, /\/chat`,/);
    assert.match(api, /JSON\.stringify\(input\)/);
    assert.doesNotMatch(dialog, /author_setup_pending/);
  });

  it("keeps history readable and disables sending for ineligible authors", () => {
    assert.match(
      integrityMediaAuthorComposeBlockedCopy({
        canSend: false,
        linkState: "disabled",
        authorActivationPending: false,
        collaborationStatus: "active",
      }) ?? "",
      /disconnected/,
    );
    assert.match(
      integrityMediaAuthorComposeBlockedCopy({
        canSend: false,
        linkState: "linked",
        authorActivationPending: false,
        collaborationStatus: "blocked",
      }) ?? "",
      /blocked/,
    );
    assert.match(
      integrityMediaAuthorComposeBlockedCopy({
        canSend: false,
        linkState: "linked",
        authorActivationPending: false,
        collaborationStatus: "archived",
      }) ?? "",
      /archived/,
    );
    assert.equal(
      integrityMediaAuthorComposeBlockedCopy({
        canSend: true,
        linkState: "linked",
        authorActivationPending: false,
        collaborationStatus: "active",
      }),
      null,
    );

    const blocked = renderPanel({
      authors: [
        row({
          canSend: false,
          collaborationStatus: "blocked",
          participantDisplayName: "Blocked Author",
        }),
        row({
          memberId: "66666666-6666-4666-8666-666666666666",
          canSend: false,
          collaborationStatus: "archived",
          participantDisplayName: "Archived Author",
        }),
      ],
      total: 2,
    });
    assert.match(blocked, /Blocked Author/);
    assert.match(blocked, /Archived Author/);
    assert.equal((blocked.match(/History/g) ?? []).length, 2);
    assert.doesNotMatch(blocked, />Chat</);

    const dialog = renderToStaticMarkup(
      createElement(AdminIntegrityAuthorMessageDialog, {
        memberId: "22222222-2222-4222-8222-222222222222",
        participantDisplayName: "Former Author",
        canSend: false,
        linkState: "disabled",
        authorActivationPending: false,
        collaborationStatus: "active",
        isOpen: true,
        onClose: () => undefined,
        onRefresh: () => undefined,
        onUnreadCount: () => undefined,
      }),
    );
    assert.match(dialog, /Loading messages…/);
    assert.match(dialog, /disconnected/);
    assert.match(dialog, /History remains available/);
    assert.match(dialog, /disabled=""/);
    assert.match(dialog, /System notification/);
  });

  it("labels recorded replies and untitled chat in the directory", () => {
    const html = renderPanel({
      authors: [
        row({
          latestMessage: {
            messageId: "77777777-7777-4777-8777-777777777777",
            title: "",
            status: "recorded",
            lastErrorCode: null,
            createdAt: "2026-03-05T00:00:00.000Z",
            deliveredAt: null,
          },
        }),
      ],
    });
    assert.match(html, /Chat message/);
    assert.match(html, /Recorded/);
    assert.doesNotMatch(html, /Failed/);
    assert.equal(integrityMediaAuthorLatestTitle("  "), "Chat message");
    assert.equal(integrityMediaAuthorLatestTitle("Hello"), "Hello");
    assert.equal(integrityMediaAuthorLatestStatusLabel("recorded"), "Recorded");
    assert.equal(integrityMediaAuthorLatestStatusLabel("failed"), "Failed");
    assert.equal(interpretIntegrityMediaAuthorDelivery("recorded").ok, false);
    assert.equal(interpretIntegrityMediaAuthorDelivery("pending").ok, true);
  });

  it("maps known collaboration errors and hides raw backend text", () => {
    assert.equal(
      integrityMediaAuthorSafeError("author_activation_pending", "fallback"),
      "Integrity Media author setup is still finishing.",
    );
    assert.equal(
      integrityMediaAuthorSafeError("collaboration_blocked", "fallback"),
      "This Integrity Media collaboration is blocked.",
    );
    assert.equal(
      integrityMediaAuthorSafeError("collaboration_archived", "fallback"),
      "This Integrity Media collaboration is archived.",
    );
    assert.equal(
      integrityMediaAuthorSafeError("link_ineligible", "fallback"),
      "This Integrity Media collaboration is not eligible for new messages.",
    );
    assert.equal(integrityMediaAuthorSafeError("author_setup_pending", "fallback"), "fallback");
    assert.equal(
      integrityMediaAuthorSafeError("internal_stack_trace", "This message could not be sent."),
      "This message could not be sent.",
    );
    const dialog = read("features/administration/components/AdminIntegrityAuthorMessageDialog.tsx");
    assert.match(dialog, /integrityMediaAuthorSafeError/);
    assert.doesNotMatch(dialog, /formatAuthFormError/);
    assert.doesNotMatch(dialog, /author_setup_pending/);
    assert.equal(
      restoredTranscriptScrollTop({
        previousScrollHeight: 400,
        previousScrollTop: 40,
        nextScrollHeight: 700,
      }),
      340,
    );
  });

  it("keeps Integrity Authors headers and status labels on one line inside a scrolling table", () => {
    const css = read(
      "features/administration/components/admin-integrity-author-message-dialog.css",
    );
    const panel = read("features/administration/components/AdminIntegrityAuthorsPanel.tsx");
    assert.match(panel, /admin-participants-table-wrap/);
    assert.match(panel, /admin-integrity-authors-table/);
    assert.match(panel, /Connection/);
    assert.match(panel, /Messages/);
    assert.match(css, /\.admin-integrity-authors \.admin-participants-table-wrap\s*\{[^}]*overflow-x:\s*auto/);
    assert.match(css, /\.admin-integrity-authors \.admin-participants-table-wrap\s*\{[^}]*min-width:\s*0/);
    assert.match(
      css,
      /\.admin-integrity-authors \.admin-integrity-authors-table\s*\{[^}]*min-width:\s*64rem/,
    );
    assert.match(
      css,
      /\.admin-integrity-authors \.admin-integrity-authors-table\s*\{[^}]*overflow-wrap:\s*normal/,
    );
    assert.match(
      css,
      /\.admin-integrity-authors \.admin-integrity-authors-table\s*\{[^}]*word-break:\s*normal/,
    );
    assert.match(
      css,
      /\.admin-integrity-authors \.admin-integrity-authors-table th,\s*\.admin-integrity-authors \.admin-integrity-authors-table \.workspace-badge,\s*\.admin-integrity-authors \.admin-integrity-authors-table \.hu-button\s*\{[^}]*white-space:\s*nowrap/,
    );
    assert.match(css, /th:nth-child\(2\)[\s\S]*min-width:\s*10rem/);
    assert.match(css, /th:nth-child\(4\)[\s\S]*min-width:\s*8rem/);
    assert.match(css, /\.admin-participants-table__actions\s*\{[^}]*flex-wrap:\s*nowrap/);
    assert.doesNotMatch(
      css,
      /\.admin-integrity-authors-table[\s\S]*text-overflow:\s*ellipsis/,
    );
  });

  it("shows an unread badge, highlights inbound authors, and marks only a presented page", () => {
    assert.equal(inboundIntegrityMediaAuthorChatIds([]).length, 0);
    const ids = inboundIntegrityMediaAuthorChatIds([
      historyMessage({ messageId: "m-out", direction: "hu_to_im", kind: "chat" }),
      historyMessage({ messageId: "m-system", direction: "hu_to_im", kind: "system" }),
      historyMessage({ messageId: "m-in", direction: "im_to_hu", kind: "chat" }),
      historyMessage({ messageId: "m-in", direction: "im_to_hu", kind: "chat" }),
      historyMessage({ messageId: "m-note", direction: "im_to_hu", kind: "system" }),
    ]);
    assert.deepEqual(ids, ["m-in"]);
    const memberId = "22222222-2222-4222-8222-222222222222";
    assert.equal(
      buildAdminIntegrityMediaAuthorReadPath(memberId),
      `/api/v1/admin/integrity-media/authors/${memberId}/messages/read`,
    );
    assert.deepEqual(integrityMediaAuthorsQueryAfterFilter("unread"), {
      state: "unread",
      offset: 0,
      limit: 25,
    });

    const quiet = renderPanel({ authors: [row({ unreadCount: 0 })] });
    assert.doesNotMatch(quiet, /admin-integrity-authors-table__unread/);
    assert.match(quiet, /value="unread"/);
    const highlighted = renderPanel({
      authors: [row({ unreadCount: 2, participantDisplayName: "Ada Lovelace" })],
    });
    assert.match(highlighted, /admin-integrity-authors-table__unread/);
    assert.match(highlighted, /Open chat with Ada Lovelace/);

    const section = read("features/administration/components/AdminIntegrityAuthorsSection.tsx");
    assert.match(section, /ProfileSection title="Integrity Authors"/);
    assert.match(section, /unreadMessageCount > 0/);
    assert.match(section, /admin-integrity-authors__unread-badge/);
    assert.match(section, /handleStateChange\("unread"\)/);
    assert.match(section, /onUnreadCount=\{handleUnreadCount\}/);
    assert.doesNotMatch(section, /setInterval|WebSocket|EventSource/);

    const dialog = read("features/administration/components/AdminIntegrityAuthorMessageDialog.tsx");
    const layoutStart = dialog.indexOf("useLayoutEffect(() => {");
    const layout = dialog.slice(layoutStart, dialog.indexOf("if (!isOpen)", layoutStart));
    assert.match(layout, /historyPhase !== "ready"/);
    assert.match(layout, /markAdminIntegrityMediaAuthorMessagesRead/);
    assert.match(layout, /presentedIds\.length === 0/);
    const load = dialog.slice(
      dialog.indexOf("void (async () => {"),
      dialog.indexOf("}, [isOpen, memberId]"),
    );
    assert.ok(load.indexOf("if (cancelled)") < load.indexOf("presentInboundChatPage(page.messages)"));
    assert.equal(dialog.split("presentInboundChatPage(page.messages)").length - 1, 3);
    const olderCatch = dialog.slice(dialog.indexOf("async function loadOlder"), dialog.indexOf("async function refreshHistory"));
    assert.doesNotMatch(olderCatch.slice(olderCatch.indexOf("} catch")), /presentInboundChatPage/);
    const refresh = dialog.slice(dialog.indexOf("async function refreshHistory"), dialog.indexOf("async function handleChatSubmit"));
    assert.ok(refresh.indexOf("await listAdminIntegrityMediaAuthorHistory") < refresh.indexOf("presentInboundChatPage"));
    assert.doesNotMatch(dialog, /formatAuthFormError/);

    const css = read("features/administration/components/admin-integrity-author-message-dialog.css");
    const heading = read("components/member/profile-section.css");
    assert.match(css, /\.admin-integrity-authors__unread-badge\s*\{[^}]*white-space:\s*nowrap/);
    assert.match(
      heading,
      /\.profile-section__heading \.profile-section__title\s*\{[^}]*white-space:\s*nowrap/,
    );
    assert.match(heading, /overflow-wrap:\s*normal/);
  });
});

function historyMessage(
  overrides: Partial<IntegrityMediaAuthorHistoryMessage> = {},
): IntegrityMediaAuthorHistoryMessage {
  return {
    messageId: "33333333-3333-4333-8333-333333333333",
    memberId: "22222222-2222-4222-8222-222222222222",
    externalAuthorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    direction: "hu_to_im",
    kind: "chat",
    body: "Hello",
    createdAt: "2026-03-03T02:00:00.000Z",
    title: null,
    cta: null,
    actorMemberId: "22222222-2222-4222-8222-222222222222",
    replyToMessageId: null,
    delivery: null,
    ...overrides,
  };
}
