/**
 * Participant UX Pack 01 — focused web contract tests.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  getMediaRegistryProviderById,
  getMediaRegistryProviderByName,
} from "@hu/media-registry";

import { resolveProviderPresentation } from "../public-news/public-news-discovery.utils.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(dir, "../../..");
const repoRoot = path.resolve(webRoot, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webRoot, relativePath), "utf8");
}

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Participant UX Pack 01 — Allies scroll contract", () => {
  const allies = readWeb("src/features/workspace-home/components/AlliesWidget.tsx");
  const alliesCss = readWeb("src/features/workspace-home/components/allies-widget.css");

  it("renders every Ally without client-side truncation", () => {
    assert.doesNotMatch(allies, /MAX_ALLIES|slice\(0,\s*8\)/);
    assert.match(allies, /allies\.map/);
  });

  it("keeps the Allies list scroll window at max-height 320px", () => {
    assert.match(alliesCss, /\.allies-widget__list\s*\{[^}]*max-height:\s*320px/s);
    assert.match(alliesCss, /\.allies-widget__list\s*\{[^}]*overflow-y:\s*auto/s);
  });
});

describe("Participant UX Pack 01 — Notification Center identity + Clear archive", () => {
  const page = readWeb("src/features/notifications/components/NotificationCenterPageContent.tsx");
  const identity = readWeb(
    "src/features/notifications/components/NotificationCenterParticipantIdentity.tsx",
  );
  const api = readWeb("src/features/notifications/api.ts");
  const css = readWeb("src/features/notifications/notifications-page.css");

  it("places reusable Participant identity left of Notification Center", () => {
    assert.match(page, /NotificationCenterParticipantIdentity/);
    assert.match(page, /notifications-page__title-row/);
    assert.match(identity, /InitiativeAuthorIdentity/);
    assert.match(identity, /getMyPublicMemberProfilePreview/);
    assert.match(identity, /getWorkspaceMemberIdentity/);
    assert.match(identity, /\/member\/\$\{encodeURIComponent\(publicName\)\}/);
    assert.doesNotMatch(identity, /vlad-74/);
    assert.match(css, /\.notifications-page__title-row/);
  });

  it("requires ConfirmDialog before Clear archive", () => {
    assert.match(page, /Clear archive/);
    assert.match(page, /ConfirmDialog/);
    assert.match(page, /Clear notification archive\?/);
    assert.match(page, /setClearArchiveOpen\(true\)/);
    assert.match(page, /clearArchivedNotifications/);
    assert.match(api, /\/api\/v1\/notifications\/archive/);
    assert.match(api, /method:\s*"DELETE"/);
  });
});

describe("Participant UX Pack 01 — /initiatives Civic Share + compact meta", () => {
  const world = readWeb("src/features/initiatives/components/WorldInitiativesPageContent.tsx");
  const worldCss = readWeb("src/features/initiatives/components/world-initiatives-page.css");

  it("uses CivicShareButton outside the card Link with Share Fix 01 props", () => {
    assert.match(world, /CivicShareButton/);
    assert.match(world, /buildPublicInitiativeSharePayload/);
    assert.match(world, /stopPropagation/);
    assert.match(world, /compact/);
    const shareIdx = world.indexOf("<CivicShareButton");
    const linkIdx = world.indexOf("className=\"world-initiative-card__link\"");
    assert.ok(shareIdx > 0 && linkIdx > shareIdx, "Share must sit outside / before Link");
  });

  it("uses a responsive two-column compact metadata layout", () => {
    assert.match(world, /world-initiative-card__meta/);
    assert.match(worldCss, /grid-template-columns:\s*1fr 1fr/);
    assert.match(worldCss, /@media \(max-width:\s*420px\)[\s\S]*grid-template-columns:\s*1fr/s);
    assert.match(worldCss, /\.world-initiative-card\s*\{[^}]*overflow:\s*visible/s);
  });
});

describe("Participant UX Pack 01 — POLITICO in Media horizontal rail", () => {
  it("appears exactly once with the canonical logo asset", () => {
    assert.equal(
      getMediaRegistryProviderById("politico")?.logoUrl,
      "/images/media/politico.webp",
    );
    assert.equal(
      getMediaRegistryProviderByName("POLITICO")?.logoUrl,
      "/images/media/politico.webp",
    );
    assert.equal(resolveProviderPresentation("POLITICO").logoUrl, "/images/media/politico.webp");
    assert.ok(existsSync(path.join(webRoot, "public/images/media/politico.webp")));

    const trustedSource = readRepo("apps/api/src/modules/civic-media-center/content/trusted-media.ts");
    const idMatches = trustedSource.match(/id:\s*"politico"/g) ?? [];
    assert.equal(idMatches.length, 1);
    assert.match(
      trustedSource,
      /id:\s*"politico"[\s\S]*?logoUrl:\s*"\/images\/media\/politico\.webp"/,
    );
  });
});
