/**
 * Share Fix 01 — mini-card Share opens civic popover; never auto navigator.share.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { shouldOfferNativeShareShortcut } from "./civic-share-native-policy.js";
import {
  buildFacebookShareUrl,
  buildLinkedInShareUrl,
  buildMailtoShareUrl,
  buildXShareUrl,
} from "./civic-share.urls.js";
import { shareCivicChannel } from "./civic-share.actions.js";

const dir = path.dirname(fileURLToPath(import.meta.url));

function read(relativePath: string): string {
  return readFileSync(path.resolve(dir, relativePath), "utf8");
}

describe("Share Fix 01 — Latest Civic Initiatives mini-card share", () => {
  const button = read("./CivicShareButton.tsx");
  const miniCard = read("../public-initiative-mini-card/PublicInitiativeMiniCard.tsx");
  const miniCss = read("../public-initiative-mini-card/public-initiative-mini-card.css");
  const shareCss = read("./civic-share.css");
  const center = read(
    "../public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
  );
  const homeLatest = read(
    "../public-home-v2/components/PublicHomeLatestInitiativesSection.tsx",
  );

  it("Home Latest Civic Initiatives uses PublicInitiativeMiniCard + CivicShareButton", () => {
    assert.match(homeLatest, /PublicInitiativeMiniCard/);
    assert.match(miniCard, /CivicShareButton/);
    assert.match(miniCard, /compact/);
  });

  it("main Share trigger only toggles popover — does not call navigator.share", () => {
    assert.match(button, /setOpen\(\(current\) => !current\)/);
    assert.match(button, /never invoke Web Share API here/);
    const triggerStart = button.indexOf('className="civic-share__trigger"');
    const triggerClick = button.indexOf("onClick={(event) => {", triggerStart);
    const triggerEnd = button.indexOf("onMouseDown={stopCardBubble}", triggerClick);
    const triggerBlock = button.slice(triggerClick, triggerEnd);
    assert.match(triggerBlock, /setOpen/);
    assert.doesNotMatch(triggerBlock, /shareCivicViaNative|shareCivicChannel|navigator\.share\(/);
  });

  it("desktop does not offer native share as a default shortcut", () => {
    assert.equal(shouldOfferNativeShareShortcut({ viewportWidth: 1280, pointerCoarse: false }), false);
    assert.equal(shouldOfferNativeShareShortcut({ viewportWidth: 500, pointerCoarse: false }), true);
    assert.equal(shouldOfferNativeShareShortcut({ viewportWidth: 1280, pointerCoarse: true }), true);
    assert.match(button, /shouldOfferNativeShareShortcut/);
    assert.match(button, /showNativeShortcut/);
  });

  it("Facebook / LinkedIn / X / email channel builders remain canonical", () => {
    const url = "https://example.test/initiatives/public/a";
    assert.match(buildFacebookShareUrl(url), /facebook\.com\/sharer/);
    assert.match(buildLinkedInShareUrl(url), /linkedin\.com\/sharing/);
    assert.match(buildXShareUrl(url, "Title"), /twitter\.com\/intent/);
    assert.match(
      buildMailtoShareUrl(
        {
          url,
          title: "Title",
          contentType: "initiative",
          initiativeId: "a",
        },
        url,
      ),
      /^mailto:/,
    );
  });

  it("Instagram invokes native share only through the Instagram channel action", async () => {
    const actions = read("./civic-share.actions.ts");
    assert.match(actions, /case "instagram":[\s\S]*shareCivicViaNative/);
    assert.match(button, /handleOption\(option\.channel\)/);
    assert.match(button, /handleNativeShare/);
  });

  it("Copy Link remains a popover channel", () => {
    assert.match(button, /channel: "copy"/);
    assert.match(button, /Copy link/);
  });

  it("Share is outside the card navigation Link", () => {
    assert.match(miniCard, /<article className="public-initiative-mini-card">/);
    assert.match(miniCard, /public-initiative-mini-card__share/);
    assert.match(miniCard, /public-initiative-mini-card__link/);
    const shareIndex = miniCard.indexOf("public-initiative-mini-card__share");
    const linkIndex = miniCard.indexOf('className="public-initiative-mini-card__link"');
    assert.ok(shareIndex > 0 && linkIndex > shareIndex);
    assert.doesNotMatch(
      miniCard.slice(linkIndex),
      /CivicShareButton/,
    );
  });

  it("Share click stops card navigation; normal link remains for View Initiative", () => {
    assert.match(miniCard, /stopPropagation/);
    assert.match(miniCard, /View Initiative/);
    assert.match(button, /stopCardNavigation|stopCardBubble/);
  });

  it("popover portals above carousel clipping", () => {
    assert.match(button, /createPortal/);
    assert.match(button, /document\.body/);
    assert.match(shareCss, /civic-share__popover--arming/);
    assert.match(miniCss, /overflow:\s*visible/);
    assert.match(miniCss, /public-initiative-mini-card__link[\s\S]*overflow:\s*hidden/);
  });

  it("full Initiative page still uses the same CivicShareButton", () => {
    assert.match(center, /CivicShareButton/);
    assert.doesNotMatch(center, /compact/);
  });

  it("channel dispatcher rejects private URLs", async () => {
    const result = await shareCivicChannel("facebook", {
      url: "/workspace/initiatives",
      title: "Private",
      contentType: "initiative",
      initiativeId: "x",
    });
    assert.equal(result.ok, false);
  });
});
