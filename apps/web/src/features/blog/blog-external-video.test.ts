import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { buildExternalVideoEmbedUrl } from "@hu/types";

import { acceptedBlogExternalVideo } from "./blog-article-video.js";

const here = path.dirname(fileURLToPath(import.meta.url));

describe("Blog external video", () => {
  it("accepts only a canonical YouTube or Vimeo identity and renders it through the sandboxed player", () => {
    const page = readFileSync(path.join(here, "components/BlogArticlePageContent.tsx"), "utf8");
    const preview = readFileSync(path.join(here, "components/BlogPreviewPageContent.tsx"), "utf8");
    const review = readFileSync(path.join(here, "components/EditorialReviewPageContent.tsx"), "utf8");
    const player = readFileSync(path.join(here, "components/BlogArticleVideo.tsx"), "utf8");
    const editor = readFileSync(path.join(here, "components/BlogPostEditor.tsx"), "utf8");
    const css = readFileSync(path.join(here, "blog.css"), "utf8");
    const embed = readFileSync(
      path.join(here, "../initiatives/components/ExternalVideoEmbed.tsx"),
      "utf8",
    );

    assert.match(page, /post\.externalVideo \?/);
    assert.match(page, /<BlogArticleVideo video=\{post\.externalVideo\} title=\{titleForDisplay\} \/>/);
    assert.match(page, /<BlogArticleBody html=\{bodyHtml\} \/>/);
    assert.doesNotMatch(page, /<iframe/);
    assert.match(preview, /post\.externalVideo \?/);
    assert.match(review, /preview\.externalVideo \?/);
    assert.match(player, /ExternalVideoEmbed/);
    assert.match(player, /acceptedBlogExternalVideo/);
    assert.doesNotMatch(player, /<iframe|dangerouslySetInnerHTML/);
    assert.doesNotMatch(editor, /externalVideo|youtube|vimeo|<iframe/i);
    assert.match(css, /\.blog-article__video \.external-video-embed[\s\S]*aspect-ratio:\s*16\s*\/\s*9/);
    assert.match(embed, /sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"/);
    assert.match(embed, /allow="encrypted-media; picture-in-picture"/);
    assert.doesNotMatch(embed, /autoplay=/);

    const youtube = acceptedBlogExternalVideo({
      source: "integrity-media",
      provider: "youtube",
      providerVideoId: "dQw4w9WgXcQ",
    });
    assert.equal(youtube?.provider, "youtube");
    assert.equal(
      youtube ? buildExternalVideoEmbedUrl(youtube.provider, youtube.providerVideoId) : "",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1",
    );
    const vimeo = acceptedBlogExternalVideo({
      source: "integrity-media",
      provider: "vimeo",
      providerVideoId: "76979871",
    });
    assert.equal(
      vimeo ? buildExternalVideoEmbedUrl(vimeo.provider, vimeo.providerVideoId) : "",
      "https://player.vimeo.com/video/76979871?title=0&byline=0",
    );
    assert.equal(
      acceptedBlogExternalVideo({
        source: "integrity-media",
        provider: "youtube",
        providerVideoId: "<iframe>",
      }),
      null,
    );
    assert.equal(
      acceptedBlogExternalVideo({
        source: "integrity-media",
        provider: "vimeo",
        providerVideoId: "not-a-number",
      }),
      null,
    );
    const integrityMedia = acceptedBlogExternalVideo({
      source: "integrity-media",
      provider: "integrity-media",
      providerVideoId: "0b3c7e2a-5d4f-4c1b-9a8e-6f2d1c0b9a87",
    });
    assert.equal(integrityMedia?.provider, "integrity-media");
    assert.equal(
      integrityMedia ? buildExternalVideoEmbedUrl(integrityMedia.provider, integrityMedia.providerVideoId) : "",
      "https://integrity.website/embed/videos/0b3c7e2a-5d4f-4c1b-9a8e-6f2d1c0b9a87",
    );
    for (const providerVideoId of [
      "0B3C7E2A-5D4F-4C1B-9A8E-6F2D1C0B9A87",
      "not-a-uuid",
      "0b3c7e2a-5d4f-4c1b-9a8e-6f2d1c0b9a87?autoplay=1",
      "../../evil",
    ]) {
      assert.equal(
        acceptedBlogExternalVideo({ source: "integrity-media", provider: "integrity-media", providerVideoId }),
        null,
        providerVideoId,
      );
    }
    assert.equal(
      buildExternalVideoEmbedUrl("youtube", "dQw4w9WgXcQ").includes("autoplay"),
      false,
    );
    assert.equal(
      buildExternalVideoEmbedUrl("vimeo", "76979871").includes("autoplay"),
      false,
    );
  });
});
