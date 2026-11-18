/**
 * HU-RRP-03H — browser E2E gate for full RRP UI workflow.
 *
 * This suite does NOT invent a Production path. It only runs when an isolated
 * local stack is explicitly provided via env. Otherwise it records prerequisites
 * and skips — do not treat skip as PASS.
 *
 * Required env (all must be set):
 * - RRP_E2E_BASE_URL — isolated WEB origin (e.g. http://127.0.0.1:3000)
 * - RRP_E2E_PARTICIPANT_EMAIL / RRP_E2E_PARTICIPANT_PASSWORD — verified test participant
 * - RRP_E2E_ADMIN_EMAIL / RRP_E2E_ADMIN_PASSWORD — test administrator
 *
 * Also required outside this file:
 * - WEB built with NEXT_PUBLIC_RRP_APPLICATION_ENTRY_ENABLED=true (isolated build only)
 * - API against isolated MongoDB replica set + hu_test_ / ephemeral database
 * - Optional local RS without Docker:
 *     pnpm --filter @hu/api exec tsx ./scripts/rrp-03h-isolated-mongo-harness.mts
 * - docker-compose.local.yml alone is standalone Mongo (not enough for appoint txn)
 * - No Production Mongo / accounts / applicant data
 *
 * Skip ≠ PASS. This file must remain skipped unless RRP_E2E_* env is complete.
 */
import { test, expect } from "@playwright/test";

const baseUrl = process.env.RRP_E2E_BASE_URL?.trim() ?? "";
const participantEmail = process.env.RRP_E2E_PARTICIPANT_EMAIL?.trim() ?? "";
const participantPassword = process.env.RRP_E2E_PARTICIPANT_PASSWORD?.trim() ?? "";
const adminEmail = process.env.RRP_E2E_ADMIN_EMAIL?.trim() ?? "";
const adminPassword = process.env.RRP_E2E_ADMIN_PASSWORD?.trim() ?? "";

const isolatedStackReady =
  Boolean(baseUrl) &&
  Boolean(participantEmail) &&
  Boolean(participantPassword) &&
  Boolean(adminEmail) &&
  Boolean(adminPassword);

const prerequisites = [
  "RRP_E2E_BASE_URL pointing at an isolated WEB instance",
  "WEB rebuild with NEXT_PUBLIC_RRP_APPLICATION_ENTRY_ENABLED=true (isolated only; Production stays OFF)",
  "API connected to isolated MongoDB replica set (not Production; not standalone-only for appoint txn)",
  "Verified test participant + test admin credentials (RRP_E2E_*_EMAIL/PASSWORD)",
  "No Production MongoDB, Production accounts, or real applicant data",
].join("; ");

test.describe("HU-RRP-03H browser E2E", () => {
  test.skip(!isolatedStackReady, `Isolated browser stack unavailable. Prerequisites: ${prerequisites}`);

  test("Join the Program reaches workspace apply intent when flag-enabled stack is up", async ({
    page,
  }) => {
    await page.goto(`${baseUrl}/regional-program`);
    await expect(page.getByRole("link", { name: /Join the Program/i })).toBeVisible();
    await page.getByRole("link", { name: /Join the Program/i }).click();
    // Flag-ON Join should land on login or workspace apply — never Production mailto-only path.
    await expect(page).toHaveURL(/login|workspace|confirm-email|register/i);
  });
});
