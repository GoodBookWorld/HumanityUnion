/**
 * Task 03 — Workspace Messages + Member profile WEB_UI reconnect.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function messages(locale: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(path.join(webSrc, `features/i18n/messages/${locale}.json`), "utf8"),
  ) as Record<string, unknown>;
}

function tFromCatalog(
  catalog: Record<string, unknown>,
  namespace: string,
): (key: string, values?: Record<string, string | number>) => string {
  const parts = namespace.split(".");
  let ns: unknown = catalog;
  for (const part of parts) {
    ns = (ns as Record<string, unknown>)[part];
  }
  const root = ns as Record<string, unknown>;
  return (key, values) => {
    const segs = key.split(".");
    let cur: unknown = root;
    for (const seg of segs) {
      if (!cur || typeof cur !== "object") return key;
      cur = (cur as Record<string, unknown>)[seg];
    }
    if (typeof cur !== "string") return key;
    if (!values) return cur;
    return cur.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ""));
  };
}

describe("Task 03 — Messages + Member localization", () => {
  it("Messages: chrome resolves non-English; bodies/names stay raw", () => {
    const workspace = readWeb(
      "features/direct-messaging/components/DirectMessagesWorkspace.tsx",
    );
    const mode = readWeb(
      "features/direct-messaging/components/CommunicationModeSwitch.tsx",
    );
    const allies = readWeb("features/direct-messaging/components/ActiveAlliesPanel.tsx");
    const conversation = readWeb(
      "features/direct-messaging/components/DirectConversationView.tsx",
    );

    assert.match(workspace, /useTranslations\("workspace\.messagesPage"\)/);
    assert.match(mode, /t\("modePersonal"\)/);
    assert.match(allies, /participantPublic\.messaging/);
    assert.match(conversation, /useTranslations\("workspace\.messagesPage\.conversation"\)/);
    assert.match(conversation, /t\("send"\)/);
    assert.match(conversation, /t\("kicker"\)/);
    const admin = readWeb(
      "features/direct-messaging/components/AdminAllParticipantsPanel.tsx",
    );
    const groupList = readWeb(
      "features/initiative-group-chat/components/InitiativeGroupList.tsx",
    );
    // Participant-visible JSX must not hardcode English (ignore block comments).
    const stripComments = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.doesNotMatch(stripComments(workspace), /Select an Ally/);
    assert.doesNotMatch(stripComments(mode), /Personal Chat/);
    assert.doesNotMatch(stripComments(allies), /\{isOpening \? "Opening…" : "Message"\}/);
    assert.doesNotMatch(stripComments(conversation), />\s*Send\s*</);
    assert.doesNotMatch(stripComments(admin), /Search participants/);
    assert.doesNotMatch(stripComments(groupList), /Search by title/);
    assert.match(groupList, /resolveLifecyclePhaseDisplayLabel/);
    assert.doesNotMatch(workspace, /locale\s*===\s*["'](?:en|uk|ar|zh-Hant)["']/);

    // Participant content remains raw bindings.
    assert.match(conversation, /message\.text|body|content/);
    assert.match(allies, /ally\.displayName/);

    const uk = messages("uk");
    const t = tFromCatalog(uk, "workspace.messagesPage");
    const tMsg = tFromCatalog(uk, "participantPublic.messaging");
    assert.equal(t("title"), "Повідомлення");
    assert.equal(t("modePersonal"), "Особистий чат");
    assert.equal(t("conversation.send"), "Надіслати");
    assert.equal(tMsg("message"), "Повідомлення");
    assert.notEqual(t("title"), tFromCatalog(messages("en"), "workspace.messagesPage")("title"));
  });

  it("Member: chrome resolves non-English; inputs stay raw; membershipPublic reused", () => {
    const pageShell = readWeb(
      "features/member-profile/components/MemberProfilePageShell.tsx",
    );
    const workspace = readWeb(
      "features/member-profile/components/MemberProfileWorkspace.tsx",
    );
    const membership = readWeb(
      "features/membership/components/MembershipProfileSection.tsx",
    );

    assert.match(pageShell, /useTranslations\("memberProfile"\)/);
    assert.match(workspace, /useTranslations\("memberProfile"\)/);
    assert.match(workspace, /sections\.profile/);
    assert.match(workspace, /fields\.displayName/);
    assert.match(workspace, /privacy\.messagingPolicy/);
    assert.doesNotMatch(workspace, /"Display name"/);
    assert.doesNotMatch(workspace, /Who can see my public profile/);

    const summaries = readWeb(
      "features/member-profile/components/MemberSettingsSummaries.tsx",
    );
    assert.match(summaries, /useTranslations\("memberProfile\.summaries"\)/);
    assert.doesNotMatch(
      summaries.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""),
      /Member Settings/,
    );

    assert.match(membership, /useTranslations\("membershipPublic"\)/);
    assert.match(membership, /membershipApplicationStatusLabelKey|membershipContributionStatusLabelKey/);
    assert.doesNotMatch(membership, /formatMembershipApplicationStatus/);
    assert.doesNotMatch(membership, /formatMembershipJourneySummary/);

    assert.match(workspace, /value=\{profile\.displayName\}/);
    assert.match(workspace, /value=\{profile\.biography/);

    const uk = messages("uk");
    const t = tFromCatalog(uk, "memberProfile");
    assert.equal(t("title"), "Профіль");
    assert.equal(t("sections.privacy"), "Конфіденційність");
    assert.equal(t("fields.biography"), "Біографія");
    assert.notEqual(t("saveProfile"), tFromCatalog(messages("en"), "memberProfile")("saveProfile"));
  });

  it("Architecture: no locale branching; PLP biography not invented on owner edit", () => {
    for (const file of [
      "features/direct-messaging/components/DirectMessagesWorkspace.tsx",
      "features/member-profile/components/MemberProfileWorkspace.tsx",
      "features/membership/components/MembershipProfileSection.tsx",
    ]) {
      const src = readWeb(file);
      assert.doesNotMatch(src, /locale\s*===\s*["'](?:en|uk|ar|zh-Hant)["']/);
      assert.doesNotMatch(src, /gemini|provider-on-read/i);
      assert.doesNotMatch(src, /participant_public|resolvePublishedLocalized/i);
    }

    for (const locale of ["en", "uk", "ar", "zh-Hant"] as const) {
      const catalog = messages(locale);
      assert.equal(
        typeof (catalog.workspace as { messagesPage: { title: string } }).messagesPage.title,
        "string",
      );
      assert.equal(typeof (catalog.memberProfile as { title: string }).title, "string");
    }
  });
});
