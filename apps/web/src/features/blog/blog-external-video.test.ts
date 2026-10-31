import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { buildExternalVideoEmbedUrl, type BlogExternalVideo } from "@hu/types";

import { withRequestedPlayback } from "../initiatives/components/ExternalVideoEmbed.js";
import { acceptedBlogExternalVideo, planBlogArticleMedia } from "./blog-article-video.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const IM_VIDEO_ID = "0b3c7e2a-5d4f-4c1b-9a8e-6f2d1c0b9a87";

function video(provider: BlogExternalVideo["provider"], providerVideoId: string): BlogExternalVideo {
  return { source: "integrity-media", provider, providerVideoId };
}

const youtube = video("youtube", "dQw4w9WgXcQ");
const vimeo = video("vimeo", "76979871");
const integrityMedia = video("integrity-media", IM_VIDEO_ID);

describe("Blog external video", () => {
  it("accepts only a canonical provider identity and builds its fixed embed URL", () => {
    const acceptedYoutube = acceptedBlogExternalVideo(youtube);
    assert.equal(
      acceptedYoutube ? buildExternalVideoEmbedUrl(acceptedYoutube.provider, acceptedYoutube.providerVideoId) : "",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1",
    );
    const acceptedVimeo = acceptedBlogExternalVideo(vimeo);
    assert.equal(
      acceptedVimeo ? buildExternalVideoEmbedUrl(acceptedVimeo.provider, acceptedVimeo.providerVideoId) : "",
      "https://player.vimeo.com/video/76979871?title=0&byline=0",
    );
    const acceptedIm = acceptedBlogExternalVideo(integrityMedia);
    assert.equal(acceptedIm?.provider, "integrity-media");
    assert.equal(
      acceptedIm ? buildExternalVideoEmbedUrl(acceptedIm.provider, acceptedIm.providerVideoId) : "",
      `https://integrity.website/embed/videos/${IM_VIDEO_ID}`,
    );
    for (const rejected of [
      video("youtube", "<iframe>"),
      video("vimeo", "not-a-number"),
      video("integrity-media", IM_VIDEO_ID.toUpperCase()),
      video("integrity-media", "not-a-uuid"),
      video("integrity-media", `${IM_VIDEO_ID}?autoplay=1`),
      video("integrity-media", "../../evil"),
    ]) {
      assert.equal(acceptedBlogExternalVideo(rejected), null, rejected.providerVideoId);
    }
    for (const provider of ["youtube", "vimeo", "integrity-media"] as const) {
      const id = provider === "youtube" ? "dQw4w9WgXcQ" : provider === "vimeo" ? "76979871" : IM_VIDEO_ID;
      assert.equal(buildExternalVideoEmbedUrl(provider, id).includes("autoplay"), false);
    }
  });
});

describe("Blog unified cover and video", () => {
  const read = (relative: string) => readFileSync(path.join(here, relative), "utf8");
  const media = read("components/BlogArticleMedia.tsx");
  const css = read("blog.css");
  const embed = read("../initiatives/components/ExternalVideoEmbed.tsx");
  const views = {
    article: read("components/BlogArticlePageContent.tsx"),
    preview: read("components/BlogPreviewPageContent.tsx"),
    review: read("components/EditorialReviewPageContent.tsx"),
  };

  it("uses the cover as the poster for every provider when both exist", () => {
    for (const item of [youtube, vimeo, integrityMedia]) {
      const plan = planBlogArticleMedia({ hasCoverImage: true, video: item });
      assert.equal(plan.kind, "video", item.provider);
      assert.ok(plan.kind === "video");
      assert.equal(plan.video.provider, item.provider);
      assert.equal(plan.video.providerVideoId, item.providerVideoId);
      assert.deepEqual(plan.poster, { kind: "cover" });
    }
  });

  it("uses the YouTube thumbnail without a cover and the player for Vimeo and Integrity Media", () => {
    assert.deepEqual(planBlogArticleMedia({ hasCoverImage: false, video: youtube }), {
      kind: "video",
      video: acceptedBlogExternalVideo(youtube),
      poster: { kind: "youtube-thumbnail", url: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg" },
    });
    for (const item of [vimeo, integrityMedia]) {
      const plan = planBlogArticleMedia({ hasCoverImage: false, video: item });
      assert.ok(plan.kind === "video");
      assert.equal(plan.poster, null, item.provider);
      assert.equal(plan.video.provider, item.provider);
    }
  });

  it("keeps the plain cover when there is no playable video", () => {
    assert.deepEqual(planBlogArticleMedia({ hasCoverImage: true }), { kind: "cover" });
    assert.deepEqual(planBlogArticleMedia({ hasCoverImage: false, video: null }), { kind: "cover" });
    assert.deepEqual(
      planBlogArticleMedia({ hasCoverImage: true, video: video("integrity-media", "not-a-uuid") }),
      { kind: "cover" },
    );
  });

  it("renders one media block in the article, preview, and editorial views", () => {
    for (const [name, page] of Object.entries(views)) {
      assert.equal(page.match(/<BlogArticleMedia\b/g)?.length, 1, name);
      assert.doesNotMatch(page, /<BlogCoverImage\b|<BlogArticleVideo\b|<ExternalVideoEmbed\b|<iframe/, name);
      assert.match(page, /video=\{(post|preview)\.externalVideo\}/, name);
      assert.match(page, /coverImage=\{(post|preview)\.coverImage\}/, name);
    }
    assert.match(views.article, /<BlogArticleBody html=\{bodyHtml\} \/>/);
  });

  it("mounts the provider player in the same container only after Play", () => {
    assert.match(media, /const \[playing, setPlaying\] = useState\(false\)/);
    assert.match(media, /playing \|\| !plan\.poster \?/);
    assert.match(media, /provider=\{plan\.video\.provider\}/);
    assert.match(media, /providerVideoId=\{plan\.video\.providerVideoId\}/);
    assert.match(media, /type="button"[\s\S]*onClick=\{\(\) => setPlaying\(true\)\}[\s\S]*aria-label=\{`Play video: \$\{title\}`\}/);
    assert.match(media, /className="blog-article__cover blog-article__video"/);
    assert.equal(media.match(/<ExternalVideoEmbed\b/g)?.length, 1);
    assert.doesNotMatch(media, /<iframe|dangerouslySetInnerHTML/i);
    assert.match(media, /<div className="blog-article__cover">\s*<BlogCoverImage[\s\S]*className="blog-article__cover-image"/);
  });

  it("requests playback only from the Play click", () => {
    assert.equal(media.match(/autoplay=\{/g)?.length, 1);
    assert.match(media, /autoplay=\{playing\}/);
    assert.match(embed, /autoplay = false,/);
    assert.match(embed, /const src = autoplay \? withRequestedPlayback\(embedUrl\) : embedUrl;/);
    for (const caller of [
      "../initiatives/components/InitiativeImage.tsx",
      "../media-upload/components/InitiativeCoverMediaField.tsx",
    ]) {
      const source = read(caller);
      assert.match(source, /<ExternalVideoEmbed\b/, caller);
      assert.doesNotMatch(source, /<ExternalVideoEmbed\b[^>]*\bautoplay\b/, caller);
    }
  });

  it("adds the provider autoplay flag without changing provider, path, or video id", () => {
    assert.equal(
      withRequestedPlayback(buildExternalVideoEmbedUrl("youtube", "dQw4w9WgXcQ")),
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&autoplay=1",
    );
    assert.equal(
      withRequestedPlayback(buildExternalVideoEmbedUrl("vimeo", "76979871")),
      "https://player.vimeo.com/video/76979871?title=0&byline=0&autoplay=1",
    );
    assert.equal(
      withRequestedPlayback(buildExternalVideoEmbedUrl("integrity-media", IM_VIDEO_ID)),
      `https://integrity.website/embed/videos/${IM_VIDEO_ID}?autoplay=1`,
    );
  });

  it("keeps the iframe security model unchanged", () => {
    assert.match(embed, /sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"/);
    assert.match(embed, /const PLAYER_PERMISSIONS = "encrypted-media; picture-in-picture";/);
    assert.match(embed, /allow=\{autoplay \? `autoplay; \$\{PLAYER_PERMISSIONS\}` : PLAYER_PERMISSIONS\}/);
    assert.match(embed, /referrerPolicy="strict-origin-when-cross-origin"/);
    assert.equal(embed.match(/sandbox=/g)?.length, 1);
  });

  it("uses 16:9 only for video and keeps image-only covers at their own ratio", () => {
    assert.match(css, /\.blog-article__video-frame \{[^}]*aspect-ratio:\s*16\s*\/\s*9/);
    assert.match(media, /<div className="blog-article__cover blog-article__video">\s*<div className="blog-article__video-frame">/);
    // The poster must outrank the editorial preview's `.editorial-review__preview .blog-article__cover .blog-cover-image`.
    assert.match(
      css,
      /\.blog-article__cover\.blog-article__video \.blog-article__video-frame \.blog-article__media-poster \{[^}]*position:\s*absolute/,
    );
    assert.doesNotMatch(css, /\.blog-article__cover\.blog-article__video \{[^}]*aspect-ratio/);
    assert.match(
      css,
      /\.blog-article__cover \.blog-cover-image,\s*\.blog-article__cover \.blog-article__cover-image \{[^}]*aspect-ratio:\s*auto/,
    );
    assert.match(css, /\.blog-article__video \.external-video-embed \{[^}]*aspect-ratio:\s*16\s*\/\s*9/);
    assert.match(css, /\.blog-article__play-button:focus-visible \{[^}]*outline:/);
    assert.match(css, /@media \(max-width: 40rem\) \{\s*\.blog-article__play-icon/);
    assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}/);
  });
});
