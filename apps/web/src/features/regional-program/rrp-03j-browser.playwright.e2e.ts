/**
 * HU-RRP-03J.1 — full isolated browser E2E for Regional Representative Program.
 *
 * Requires an isolated stack (see apps/api/scripts/rrp-03j-isolated-e2e-stack.mts):
 * - MongoMemoryReplSet + hu_test_* database
 * - Local API with injected Turnstile verifier
 * - WEB with NEXT_PUBLIC_RRP_APPLICATION_ENTRY_ENABLED=true
 * - Seeded verified participant + admin
 *
 * Skip ≠ PASS. All RRP_E2E_* env vars must be set.
 * Prefer normal Playwright pointer/keyboard actions — no DOM .click() bypasses.
 */
import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const baseUrl = process.env.RRP_E2E_BASE_URL?.trim() ?? "";
const apiBaseUrl = process.env.RRP_E2E_API_BASE_URL?.trim() ?? "";
const participantEmail = process.env.RRP_E2E_PARTICIPANT_EMAIL?.trim() ?? "";
const participantPassword = process.env.RRP_E2E_PARTICIPANT_PASSWORD?.trim() ?? "";
const adminEmail = process.env.RRP_E2E_ADMIN_EMAIL?.trim() ?? "";
const adminPassword = process.env.RRP_E2E_ADMIN_PASSWORD?.trim() ?? "";
const secondEmail = process.env.RRP_E2E_SECOND_EMAIL?.trim() ?? "";
const secondPassword = process.env.RRP_E2E_SECOND_PASSWORD?.trim() ?? "";

const isolatedStackReady =
  Boolean(baseUrl) &&
  Boolean(apiBaseUrl) &&
  Boolean(participantEmail) &&
  Boolean(participantPassword) &&
  Boolean(adminEmail) &&
  Boolean(adminPassword);

const prerequisites =
  "RRP_E2E_BASE_URL, RRP_E2E_API_BASE_URL, participant+admin credentials, isolated WEB flag-ON, API on MemoryReplSet hu_test_*";

test.describe.configure({ mode: "serial", timeout: 180_000 });

test.describe("HU-RRP-03J full isolated browser E2E", () => {
  test.skip(!isolatedStackReady, `Isolated browser stack unavailable. Prerequisites: ${prerequisites}`);

  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
    await context.addInitScript(() => {
      const mock = {
        render(_host: unknown, options: { callback?: (token: string) => void }) {
          queueMicrotask(() => options.callback?.("rrp-03j-e2e-turnstile"));
          return "rrp-03j-widget";
        },
        reset() {},
        remove() {},
      };
      Object.defineProperty(window, "turnstile", {
        configurable: true,
        writable: true,
        value: mock,
      });
    });
  });

  async function apiLogin(
    request: APIRequestContext,
    email: string,
    password: string,
  ): Promise<void> {
    const response = await request.post(`${apiBaseUrl}/api/v1/auth/login`, {
      data: {
        email,
        password,
        turnstileToken: "rrp-03j-e2e-turnstile",
      },
    });
    expect(response.ok(), `login failed for ${email}: ${response.status()}`).toBeTruthy();
  }

  async function apiLogout(request: APIRequestContext): Promise<void> {
    await request.post(`${apiBaseUrl}/api/v1/auth/logout`).catch(() => undefined);
  }

  async function fillControlled(
    locator: ReturnType<Page["locator"]>,
    value: string,
  ): Promise<void> {
    await locator.click();
    await locator.fill("");
    await locator.pressSequentially(value, { delay: 15 });
  }

  /**
   * CountrySelect / GeographySearchSelect — search then pick by option role.
   * Uses keyboard Enter as a stable alternate when the option is already active.
   */
  async function selectGeographyCountry(
    page: Page,
    triggerId: string,
    searchText: string,
    optionLabel: RegExp,
  ): Promise<void> {
    const trigger = page.locator(`#${triggerId}`);
    await expect(trigger).toBeVisible({ timeout: 30_000 });
    await trigger.click();
    const search = page.locator(`#${triggerId}-search`);
    await expect(search).toBeVisible({ timeout: 15_000 });
    await search.fill(searchText);
    const option = page.getByRole("option", { name: optionLabel }).first();
    await expect(option).toBeVisible({ timeout: 15_000 });
    // Use page.keyboard so Enter can close/unmount the portaled panel without
    // Playwright retrying locator.press() on a detached search input.
    await search.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page.locator(`#${triggerId}-value`)).toHaveText(optionLabel, {
      timeout: 15_000,
    });
  }

  async function createDraftViaBrowser(page: Page, representSearch: string, representLabel: RegExp) {
    await page.goto(`${baseUrl}/workspace?rrp=apply`);
    await expect(page.locator(".rrp-application-modal")).toBeVisible({ timeout: 45_000 });
    // Hub: wait for create controls, pick representation country, start draft.
    await expect(page.locator("#rrp-new-represent-country")).toBeVisible({ timeout: 45_000 });
    await selectGeographyCountry(page, "rrp-new-represent-country", representSearch, representLabel);
    await expect(page.locator("#rrp-new-represent-country-value")).toHaveText(representLabel);
    const createDraft = page
      .locator(".rrp-application-modal")
      .getByRole("button", { name: /^Create draft$/i });
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/api/v1/rrp-applications") &&
          response.request().method() === "POST" &&
          response.ok(),
        { timeout: 45_000 },
      ),
      createDraft.click(),
    ]);
    await expect(page.locator('input[name="legalFirstName"]')).toBeVisible({ timeout: 45_000 });
  }

  async function fillAdultApplicationForm(
    page: Page,
    options?: { underage?: boolean; residenceAlreadySet?: boolean },
  ) {
    const root = page.locator(".rrp-application-modal").filter({
      has: page.locator('input[name="legalFirstName"]'),
    });
    await expect(root).toBeVisible();
    await fillControlled(root.locator('input[name="legalFirstName"]'), "Alex");
    await fillControlled(root.locator('input[name="legalLastName"]'), "Applicant");
    await fillControlled(root.locator('input[name="profession"]'), "Community organizer");

    if (!options?.residenceAlreadySet) {
      await selectGeographyCountry(page, "rrp-residence-country", "Canada", /^Canada$/i);
    }
    await expect(root.locator("#rrp-residence-country-value")).toHaveText(/Canada/i);

    // type=date is unreliable with pressSequentially in headless Chromium.
    const dob = root.locator('input[name="dateOfBirth"]');
    await dob.fill(options?.underage ? "2012-06-15" : "1990-06-15");
    await expect(dob).toHaveValue(options?.underage ? "2012-06-15" : "1990-06-15");
    await root.getByText(/Partial funding requested/i).click();
    await fillControlled(root.locator('input[name="annualRequestedAmountCad"]'), "12000");
    await fillControlled(root.locator('input[name="teamMemberCount"]'), "2");
    await fillControlled(
      root.locator('textarea[name="relevantExperience"]'),
      "Led regional civic coordination for five years across municipal programs.",
    );
    await fillControlled(
      root.locator('textarea[name="motivation"]'),
      "I want to help build trusted regional representation for participants.",
    );
    await root.locator(".rrp-application-modal__consent input[type='checkbox']").check();
    await expect(root.locator('input[name="legalFirstName"]')).toHaveValue("Alex");
  }

  test("A — Join the Program → auth returnTo → workspace apply", async ({ page }) => {
    await page.goto(`${baseUrl}/regional-program`);
    const join = page.getByRole("link", { name: /Join the Program/i }).first();
    await expect(join).toBeVisible();
    await expect(join).toHaveAttribute("href", /login\?returnTo=.*rrp%3Dapply|workspace\?rrp=apply/i);
    await join.click();
    await expect(page).toHaveURL(/login.*returnTo|workspace\?rrp=apply/i);

    if (page.url().includes("/login")) {
      await expect(page).toHaveURL(/returnTo=/i);
      await page.locator('input[type="email"]').fill(participantEmail);
      await page.locator('input[autocomplete="current-password"]').fill(participantPassword);
      await expect(page.getByRole("button", { name: /Log in/i })).toBeEnabled({ timeout: 15_000 });
      await page.getByRole("button", { name: /Log in/i }).click();
      await expect(page).toHaveURL(/workspace/i, { timeout: 30_000 });
    }
  });

  test("B — Participant draft, validation, underage, funding, consent v2, submit", async ({
    page,
  }) => {
    await apiLogin(page.request, participantEmail, participantPassword);
    await createDraftViaBrowser(page, "Canada", /^Canada$/i);

    // Required-field / underage rejection path
    await fillAdultApplicationForm(page, { underage: true });
    await page.getByRole("button", { name: /Submit application/i }).click();
    await expect(page.locator(".rrp-application-modal__error")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator(".rrp-application-modal__error")).toContainText(/date of birth|18|age/i);

    // Adult path + consent v2
    const adultDob = page.locator('input[name="dateOfBirth"]');
    await adultDob.fill("1990-06-15");
    await expect(adultDob).toHaveValue("1990-06-15");
    const consent = page.locator(".rrp-application-modal__consent input[type='checkbox']");
    if (!(await consent.isChecked())) {
      await consent.check();
    }
    await page.getByRole("button", { name: /Submit application/i }).click();
    await expect(page.getByText(/application was submitted/i)).toBeVisible({ timeout: 60_000 });
  });

  test("C — Admin review, request information, Messages reply, legacy approve blocked", async ({
    page,
  }) => {
    await apiLogin(page.request, adminEmail, adminPassword);
    await page.goto(`${baseUrl}/admin/participants`);
    await page.locator("#admin-participant-search").fill(participantEmail);
    await page.getByRole("button", { name: /Apply search/i }).click();
    await expect(page.getByText(participantEmail)).toBeVisible({ timeout: 30_000 });

    // Applicant classification filter should include funding labels
    await expect(page.locator("select").filter({ hasText: /Applicant-Self-funded/i })).toBeVisible();

    await page.getByRole("checkbox", { name: "Select RRP03J Participant", exact: true }).check();
    await page.getByRole("button", { name: /View Application/i }).click();

    const adminDialog = page.getByRole("dialog").filter({ hasText: /Regional Representative/i });
    await expect(adminDialog).toBeVisible({ timeout: 30_000 });
    const note = adminDialog.locator("#admin-rrp-review-note");
    await note.fill("Please clarify your regional coordination experience for Canada.");
    await adminDialog.getByRole("button", { name: /Request information/i }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Request more information/i)).toBeVisible();
    await page.getByRole("button", { name: /Confirm request/i }).click();
    await expect(page.getByText(/More information requested/i)).toBeVisible({ timeout: 30_000 });

    // Legacy review approve must not create approved-without-appointment
    const apps = await page.request.get(`${apiBaseUrl}/api/v1/admin/rrp-applications`);
    expect(apps.ok()).toBeTruthy();
    const appsJson = (await apps.json()) as {
      data?:
        | Array<{ applicationId: string; status: string }>
        | { items?: Array<{ applicationId: string; status: string }> };
    };
    const raw = appsJson.data;
    const items = Array.isArray(raw) ? raw : (raw?.items ?? []);
    const target = items.find((item) => item.status === "information_requested") ?? items[0];
    expect(target).toBeTruthy();
    const approveAttempt = await page.request.post(
      `${apiBaseUrl}/api/v1/admin/rrp-applications/${target!.applicationId}/review`,
      { data: { decision: "approve", note: "legacy approve must fail" } },
    );
    // Validation may 400 (decision enum) or domain may 422 (appointment-required).
    expect([400, 422]).toContain(approveAttempt.status());

    // Close review dialog, then open the RRP DM from the admin Message action.
    const closeReview = page.getByRole("button", { name: /Close application dialog|Close/i }).first();
    if (await closeReview.isVisible().catch(() => false)) {
      await closeReview.click();
    }
    await page.getByRole("checkbox", { name: "Select RRP03J Participant", exact: true }).check();
    await page.getByRole("button", { name: /Message RRP03J Participant|^Message$/i }).click();
    await expect(page).toHaveURL(/workspace\/messages/i, { timeout: 30_000 });
    await expect(
      page.getByText(/clarify your regional coordination experience/i).first(),
    ).toBeVisible({ timeout: 60_000 });
    await expect(page.locator("#direct-message-composer-input")).toBeVisible({ timeout: 30_000 });
    await page.locator("#direct-message-composer-input").fill(
      "Admin follow-up recorded in the same RRP request-information thread.",
    );
    await page.getByRole("button", { name: /^Send$/i }).click();
    await expect(
      page.getByText(/Admin follow-up recorded in the same RRP request-information thread/i).first(),
    ).toBeVisible({ timeout: 30_000 });

    // Participant workspace should reflect information_requested.
    await apiLogout(page.request);
    await apiLogin(page.request, participantEmail, participantPassword);
    await page.goto(`${baseUrl}/workspace`);
    await expect(page.locator('[data-rrp-workspace-widget="true"]')).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page
        .locator('[data-rrp-workspace-widget="true"]')
        .getByText(/More information requested/i)
        .first(),
    ).toBeVisible({ timeout: 30_000 });

    // Narrow reply path: established RRP admin conversation is reachable via
    // Notifications unread DMs (membership + recipient≠nobody). Ally directory
    // is not required for reply into an existing conversation.
    await page.goto(`${baseUrl}/notifications`);
    const openConversation = page.getByRole("link", {
      name: /Open conversation with/i,
    });
    await expect(openConversation.first()).toBeVisible({ timeout: 60_000 });
    await openConversation.first().click();
    await expect(page).toHaveURL(/workspace\/messages\//i, { timeout: 30_000 });
    await expect(page.locator("#direct-message-composer-input")).toBeVisible({ timeout: 30_000 });
    await page.locator("#direct-message-composer-input").fill(
      "Participant reply with clarified regional coordination experience for Canada.",
    );
    await page.getByRole("button", { name: /^Send$/i }).click();
    await expect(
      page
        .getByText(/Participant reply with clarified regional coordination experience/i)
        .first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("D — Confirm appointment → Representative designation", async ({ page }) => {
    await apiLogin(page.request, adminEmail, adminPassword);
    await page.goto(`${baseUrl}/admin/participants`);
    await page.locator("#admin-participant-search").fill(participantEmail);
    await page.getByRole("button", { name: /Apply search/i }).click();
    await expect(page.getByText(participantEmail)).toBeVisible({ timeout: 30_000 });
    await page.getByRole("checkbox", { name: "Select RRP03J Participant", exact: true }).check();
    await page.getByRole("button", { name: /View Application/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 30_000 });

    const approveDialog = page.getByRole("dialog").filter({ hasText: /Regional Representative/i });
    await expect(approveDialog).toBeVisible({ timeout: 30_000 });
    // information_requested → mark under review → approve/confirm
    const markReview = approveDialog.getByRole("button", { name: /Mark under review/i });
    if (await markReview.isEnabled()) {
      await markReview.click();
      await expect(page.getByText(/marked under review/i)).toBeVisible({ timeout: 30_000 });
    }

    await approveDialog.getByRole("button", { name: /^Approve$/i }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Approve and designate Representative/i)).toBeVisible();
    await page.getByRole("button", { name: /Confirm approval/i }).click();
    await expect(page.getByText(/Representative platform designation/i)).toBeVisible({
      timeout: 60_000,
    });

    await apiLogout(page.request);
    await apiLogin(page.request, participantEmail, participantPassword);
    await page.goto(`${baseUrl}/workspace`);
    await expect(page.locator('[data-rrp-platform-designation="active"]')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/Representative \(platform designation\)/i)).toBeVisible();
  });

  test("E — Second participant reject path + withdraw draft where applicable", async ({
    page,
  }) => {
    test.skip(!secondEmail || !secondPassword, "Second participant credentials not provided");

    await apiLogin(page.request, secondEmail, secondPassword);
    await createDraftViaBrowser(page, "Ukraine", /^Ukraine$/i);
    await fillAdultApplicationForm(page);
    await page.getByRole("button", { name: /Submit application/i }).click();
    await expect(page.getByText(/application was submitted/i)).toBeVisible({ timeout: 60_000 });

    await apiLogout(page.request);
    await apiLogin(page.request, adminEmail, adminPassword);
    await page.goto(`${baseUrl}/admin/participants`);
    await page.locator("#admin-participant-search").fill(secondEmail);
    await page.getByRole("button", { name: /Apply search/i }).click();
    await expect(page.getByText(secondEmail)).toBeVisible({ timeout: 30_000 });
    await page.getByRole("checkbox", { name: /Select RRP03J Participant Two/i }).check();
    await page.getByRole("button", { name: /View Application/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 30_000 });
    const rejectDialog = page.getByRole("dialog").filter({ hasText: /Regional Representative/i });
    await rejectDialog.locator("#admin-rrp-review-note").fill("Does not meet program readiness criteria.");
    await rejectDialog.getByRole("button", { name: /^Reject$/i }).click();
    await expect(page.getByText(/Application rejected/i)).toBeVisible({ timeout: 30_000 });
  });

  test("F — Localization / RTL smoke (en, uk, ar, he)", async ({ browser }) => {
    // Prefer Web-origin hu_lang write (Registry-validated). Fallback to cookie if needed.
    // Isolated stack seeds enable en/uk/ar/he — no /uk|/ar path assumption.
    const locales: Array<{ code: string; dir?: "rtl" | "ltr" }> = [
      { code: "en", dir: "ltr" },
      { code: "uk", dir: "ltr" },
      { code: "ar", dir: "rtl" },
      { code: "he", dir: "rtl" },
    ];

    for (const locale of locales) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const write = await page.request.post(`${baseUrl}/api/hu-lang`, {
        data: { locale: locale.code },
      });
      if (!write.ok()) {
        await context.addCookies([{ name: "hu_lang", value: locale.code, url: baseUrl }]);
      }
      await page.goto(`${baseUrl}/regional-program`);
      await expect(
        page
          .getByRole("link", {
            name: /Join the Program|Долучитися|انضم|הצטר|Join/i,
          })
          .first(),
      ).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.locator("body")).not.toContainText(/rrpApplication\./);
      const htmlLang = await page.locator("html").getAttribute("lang");
      expect(htmlLang?.toLowerCase().startsWith(locale.code.toLowerCase())).toBeTruthy();
      if (locale.dir === "rtl") {
        const dir = await page.locator("html").getAttribute("dir");
        expect(dir).toBe("rtl");
      } else {
        const dir = await page.locator("html").getAttribute("dir");
        expect(dir === "ltr" || dir === null || dir === "").toBeTruthy();
      }
      await page.goto(`${baseUrl}/privacy`);
      await expect(page.locator("body")).not.toContainText(/MISSING_MESSAGE|rrpApplication\./);
      // Consent v2 catalog key should resolve (no raw key leakage).
      await expect(page.locator("body")).not.toContainText(/rrp-application-consent-v2/);
      await context.close();
    }
  });
});
