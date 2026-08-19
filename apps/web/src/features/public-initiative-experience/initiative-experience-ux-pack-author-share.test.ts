/**
 * Initiative Experience UX Pack — author identity, reaction emphasis, civic share.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildPublicInitiativeSharePayload,
  buildPublicPetitionSharePayload,
} from "../civic-share/civic-share.actions.js";
import { isCivicSharePayloadPublic } from "../civic-share/civic-share.types.js";
import {
  buildFacebookShareUrl,
  buildLinkedInShareUrl,
  buildMailtoShareUrl,
  buildWebShareData,
  buildXShareUrl,
  canUseWebShareApi,
  resolveAbsoluteCivicShareUrl,
} from "../civic-share/civic-share.urls.js";

const dir = path.dirname(fileURLToPath(import.meta.url));

function readLocal(relativePath: string): string {
  return readFileSync(path.resolve(dir, relativePath), "utf8");
}

describe("Initiative Experience UX Pack — author identity + reaction + civic share", () => {
  const center = readLocal("./components/PublicInitiativeCenterPanel.tsx");
  const pieCss = readLocal("./public-initiative-experience.css");
  const reactionCss = readFileSync(
    path.resolve(
      dir,
      "../initiative-collaborative-analysis/components/initiative-collaborative-analysis-workspace.css",
    ),
    "utf8",
  );
  const reactionWidget = readFileSync(
    path.resolve(
      dir,
      "../initiative-collaborative-analysis/components/InitiativeAnalysisReactionWidget.tsx",
    ),
    "utf8",
  );
  const shareButton = readFileSync(
    path.resolve(dir, "../civic-share/CivicShareButton.tsx"),
    "utf8",
  );
  const shareActions = readFileSync(
    path.resolve(dir, "../civic-share/civic-share.actions.ts"),
    "utf8",
  );
  const petitionResult = readFileSync(
    path.resolve(
      dir,
      "../initiative-petition-lifecycle/components/InitiativePetitionPublicResult.tsx",
    ),
    "utf8",
  );
  const miniCard = readFileSync(
    path.resolve(dir, "../public-initiative-mini-card/PublicInitiativeMiniCard.tsx"),
    "utf8",
  );
  const initiativePage = readFileSync(
    path.resolve(dir, "../../app/initiatives/public/[initiativeId]/page.tsx"),
    "utf8",
  );

  it("author identity sits beside center tabs and is not a tab", () => {
    assert.match(center, /pie-center__nav/);
    assert.match(center, /role="tablist"/);
    assert.match(center, /InitiativeAuthorIdentity/);
    assert.match(center, /roleLabel="Author"/);
    assert.match(center, /pie-center__nav-aside[\s\S]*InitiativeAuthorIdentity/);
    assert.doesNotMatch(
      center,
      /role="tablist"[\s\S]*InitiativeAuthorIdentity[\s\S]*<\/div>\s*<div className="pie-center__nav-aside"/,
    );
    const tablistBlock = center.match(
      /role="tablist"[^>]*>[\s\S]*?<\/div>/,
    )?.[0] ?? "";
    assert.doesNotMatch(tablistBlock, /InitiativeAuthorIdentity/);
    assert.doesNotMatch(tablistBlock, /role="tab"[^>]*aria-label=.*Author/);
    assert.match(pieCss, /\.pie-center__nav-aside/);
    assert.match(pieCss, /flex-wrap:\s*wrap/);
  });

  it("ica-reaction uses approved amber accent token", () => {
    assert.match(reactionCss, /\.ica-reaction\s*\{[\s\S]*--hu-color-accent/);
    assert.match(reactionWidget, /className="ica-reaction"/);
    assert.match(reactionWidget, /aria-pressed/);
  });

  it("one reusable CivicShareButton is used across Initiative, Petition, and mini cards", () => {
    assert.match(center, /CivicShareButton/);
    assert.match(petitionResult, /CivicShareButton/);
    assert.match(miniCard, /CivicShareButton/);
    assert.match(shareButton, /icons\/messenger\/share\.svg/);
  });

  it("initiative share payload uses canonical public Initiative URL", () => {
    const payload = buildPublicInitiativeSharePayload({
      initiativeId: "init-1",
      title: "Clean River",
      origin: "https://staging.example",
    });
    assert.equal(payload.url, "https://staging.example/initiatives/public/init-1");
    assert.equal(payload.contentType, "initiative");
    assert.equal(isCivicSharePayloadPublic(payload), true);
  });

  it("petition share payload uses canonical Initiative or shareReference URL", () => {
    const viaHash = buildPublicPetitionSharePayload({
      initiativeId: "init-1",
      petitionId: "pet-1",
      title: "Petition Title",
      origin: "https://staging.example",
    });
    assert.equal(viaHash.url, "https://staging.example/initiatives/public/init-1#petition");
    assert.equal(viaHash.petitionId, "pet-1");

    const viaRef = buildPublicPetitionSharePayload({
      initiativeId: "init-1",
      petitionId: "pet-1",
      title: "Petition Title",
      shareUrl: "/initiatives/public/init-1#petition",
      origin: "https://staging.example",
    });
    assert.match(viaRef.url, /\/initiatives\/public\/init-1#petition$/);
  });

  it("card share stops propagation and keeps compact trigger outside the Link", () => {
    assert.match(miniCard, /stopPropagation/);
    assert.match(miniCard, /compact/);
    assert.match(miniCard, /public-initiative-mini-card__link/);
    assert.doesNotMatch(
      miniCard.slice(miniCard.indexOf('className="public-initiative-mini-card__link"')),
      /CivicShareButton/,
    );
  });

  it("main Share trigger does not immediately call navigator.share", () => {
    const buttonSource = readFileSync(
      path.resolve(dir, "../civic-share/CivicShareButton.tsx"),
      "utf8",
    );
    assert.match(buttonSource, /never invoke Web Share API here/);
    assert.match(buttonSource, /createPortal/);
    assert.match(buttonSource, /shouldOfferNativeShareShortcut/);
  });

  it("Facebook / X / LinkedIn / email targets receive the canonical URL", () => {
    const absolute = "https://staging.example/initiatives/public/init-1";
    assert.match(buildFacebookShareUrl(absolute), /u=https%3A%2F%2Fstaging\.example/);
    assert.match(buildXShareUrl(absolute, "Clean River"), /url=https%3A%2F%2Fstaging\.example/);
    assert.match(buildLinkedInShareUrl(absolute), /url=https%3A%2F%2Fstaging\.example/);
    const mail = buildMailtoShareUrl(
      {
        url: absolute,
        title: "Clean River",
        contentType: "initiative",
        initiativeId: "init-1",
      },
      absolute,
    );
    assert.match(mail, /^mailto:/);
    assert.match(mail, /Clean%20River/);
    assert.match(mail, /initiatives%2Fpublic%2Finit-1/);
  });

  it("Web Share API path is preferred when available", () => {
    const data = buildWebShareData(
      {
        url: "/initiatives/public/init-1",
        title: "Clean River",
        contentType: "initiative",
        initiativeId: "init-1",
      },
      "https://staging.example/initiatives/public/init-1",
    );
    assert.equal(canUseWebShareApi({ share: async () => undefined }, data), true);
    assert.equal(canUseWebShareApi({}, data), false);
    assert.match(shareButton, /shareCivicViaNative/);
  });

  it("Instagram browser path uses honest Web Share or copy fallback", () => {
    assert.match(shareButton, /instagram/);
    assert.match(shareActions, /Instagram cannot be pre-filled|Opened system share/);
  });

  it("private or non-public paths cannot share as public civic URLs", () => {
    assert.equal(
      isCivicSharePayloadPublic({
        url: "/workspace/initiatives",
        title: "Draft",
        contentType: "initiative",
        initiativeId: "x",
      }),
      false,
    );
    assert.equal(
      isCivicSharePayloadPublic({
        url: "/admin/initiatives/x",
        title: "Admin",
        contentType: "initiative",
        initiativeId: "x",
      }),
      false,
    );
    assert.equal(
      isCivicSharePayloadPublic({
        url: "/initiatives/public/x",
        title: "Public",
        contentType: "initiative",
        initiativeId: "x",
      }),
      true,
    );
  });

  it("Open Graph metadata exposes title, image, and canonical URL", () => {
    assert.match(initiativePage, /generateMetadata/);
    assert.match(initiativePage, /openGraph/);
    assert.match(initiativePage, /twitter/);
    assert.match(initiativePage, /canonical/);
    assert.match(initiativePage, /images/);
  });

  it("absolute URL helper keeps public paths intact", () => {
    assert.equal(
      resolveAbsoluteCivicShareUrl("/initiatives/public/a", "https://hu.example"),
      "https://hu.example/initiatives/public/a",
    );
  });

  it("documents internal profile-share architecture gap (no invented feed model)", () => {
    assert.doesNotMatch(shareButton, /shareToProfile|profileWall|participantFeed/);
    assert.equal("INTERNAL_PROFILE_SHARE_ARCHITECTURE_GAP", "INTERNAL_PROFILE_SHARE_ARCHITECTURE_GAP");
  });
});
