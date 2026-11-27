/**
 * HU-UX-01E.2 — Workspace action results stay with their controls.
 * Source contract and shared reveal queue. No live mutations.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { queueContextualFeedbackReveal } from "./reveal-contextual-feedback";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function read(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

function sliceBetween(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `missing slice ${start} .. ${end}`);
  return source.slice(from, to);
}

describe("HU-UX-01E.2 workspace contextual feedback", () => {
  const panel = read("features/auth/components/AccountPanel.tsx");
  const contextual = read("features/auth/components/ContextualActionFeedback.tsx");
  const sharedCss = read("features/auth/components/contextual-action-feedback.css");
  const preferences = read("features/preferences/components/PreferencesWorkspace.tsx");
  const profile = read("features/member-profile/components/MemberProfileWorkspace.tsx");
  const links = read("features/member-profile/components/MemberProfessionalLinksSection.tsx");
  const skills = read("features/member-profile/components/MemberSkillsEditor.tsx");
  const membership = read("features/membership/components/MembershipApplicationForm.tsx");
  const authoring = read("features/blog/components/AuthoringPageContent.tsx");
  const editor = read("features/blog/components/BlogPostEditor.tsx");
  const rrp = read("features/regional-program/components/RrpApplicationModal.tsx");
  const guide = read("../../../docs/DESIGN_SYSTEM.md");
  const login = read("features/auth/components/LoginForm.tsx");
  const feedback = read("features/auth/components/AuthFeedbackMessage.tsx");

  it("keeps the shared component independent of account panel styles", () => {
    assert.match(contextual, /contextual-action-feedback\.css/);
    assert.match(sharedCss, /margin-block-start/);
    assert.doesNotMatch(sharedCss, /margin-left|margin-right/);
    assert.doesNotMatch(contextual, /account-panel\.css/);
    assert.match(contextual, /queueContextualFeedbackReveal\(ref\.current\)/);
    assert.match(feedback, /variant === "error" \? "alert" : "status"/);
    assert.match(login, /AuthFeedbackMessage/);
  });

  it("sends Change Email through the same reveal queue", () => {
    const emailSection = sliceBetween(
      panel,
      '<ProfileSection title={t("changeEmail")}>',
      '<ProfileSection title={t("changePassword")}>',
    );
    const buttonAt = emailSection.indexOf('{t("requestEmailChange")}');
    const feedbackAt = emailSection.indexOf("<ContextualActionFeedback");
    assert.ok(feedbackAt > buttonAt);
    assert.match(panel, /checkNewEmailInbox/);
    assert.equal(panel.match(/revealContextualFeedback\(/g)?.length ?? 0, 0);
    assert.match(guide, /ContextualActionFeedback/);
    assert.match(guide, /nearest section that remains/);
  });

  it("places priority Workspace results after their controls and keeps load failures in place", () => {
    const saveButton = preferences.indexOf('type="submit"');
    const saveFeedback = preferences.indexOf("ref={saveErrorRef}");
    assert.ok(saveFeedback > saveButton);
    assert.match(preferences, /error \?\? t\("unavailable"\)/);

    const profileButton = profile.indexOf('{t("saveProfile")}');
    const profileFeedback = profile.indexOf("ref={profileErrorRef}");
    assert.ok(profileFeedback > profileButton);
    assert.doesNotMatch(sliceBetween(profile, "handleProfileSave", "handleSkillsSave"), /setLinksError|setPrivacyError/);
    assert.doesNotMatch(sliceBetween(profile, "handlePrivacySave", "if (loading)"), /setProfileError|setLinksError/);
    assert.match(profile, /error \?\? t\("unavailable"\)/);

    const linksButton = links.indexOf('type="submit"');
    assert.ok(links.indexOf("ref={errorRef}") > linksButton);

    const skillsButton = skills.indexOf('type="submit"');
    const skillsField = skills.indexOf("member-skills-editor__error");
    const skillsSave = skills.lastIndexOf("member-skills-editor__error");
    assert.ok(skillsField < skillsButton);
    assert.ok(skillsSave > skillsButton);

    const membershipButtons = membership.indexOf("membership-application-form__actions");
    assert.ok(membership.indexOf("application.successTitle") > membershipButtons);
    assert.ok(membership.indexOf("membership-application-form__error") > membershipButtons);
    assert.match(membership, /application.emailRequiredTitle/);
    assert.match(membership, /if \(submitting\)/);

    const authorButton = authoring.indexOf('type="submit"');
    assert.ok(authoring.indexOf("ref={formErrorRef}") > authorButton);
    assert.match(authoring, /fieldErrors.preferredCategoryIds/);

    const editorActions = editor.indexOf("blog-post-editor__actions");
    assert.ok(editor.indexOf("editor.banners.actionFailed") > editorActions);
    assert.match(editor, /editor.banners.blockedTitle/);
    assert.match(editor, /editor.banners.underReviewTitle/);

    const rrpFooter = rrp.indexOf("rrp-application-modal__actions");
    assert.ok(rrp.indexOf("ref={actionErrorRef}") > rrpFooter);
    assert.match(rrp, /messages.submitted/);
    assert.match(rrp, /ConfirmDialog/);
  });

  it("coordinates same-turn reveal, including a nested scroll target", async () => {
    const parentCalls: string[] = [];
    const nested = {
      getBoundingClientRect: () => ({ top: 900, left: 0, bottom: 980, right: 200 }),
      scrollIntoView: () => {
        parentCalls.push("nested");
      },
    } as unknown as HTMLElement;
    const later = {
      getBoundingClientRect: () => ({ top: 1100, left: 0, bottom: 1180, right: 200 }),
      scrollIntoView: () => {
        parentCalls.push("later");
      },
    } as unknown as HTMLElement;
    Object.assign(globalThis, {
      window: {
        innerWidth: 400,
        innerHeight: 300,
        matchMedia: () => ({ matches: false }),
      },
      document: { documentElement: { clientWidth: 400, clientHeight: 300 } },
    });
    queueContextualFeedbackReveal(nested);
    queueContextualFeedbackReveal(later);
    await Promise.resolve();
    assert.deepEqual(parentCalls, ["later"]);
  });
});
