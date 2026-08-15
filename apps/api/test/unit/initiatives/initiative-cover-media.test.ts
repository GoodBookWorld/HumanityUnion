import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { InitiativeCoverMedia } from "@hu/types";
import { buildExternalVideoEmbedUrl, parseExternalVideoUrl, resolveInitiativeCoverMedia } from "@hu/types";

import {
  validateCreateInitiativeDraftInput,
  validateSaveInitiativeDraftInput,
} from "../../../src/modules/initiatives/initiative.validators.js";

/**
 * UX Evolution Pack 03 Part 2/6/7/12 — pure Initiative Cover Media domain
 * logic: no persistence, no network, no Mongo dependency.
 */

describe("resolveInitiativeCoverMedia", () => {
  it("falls back to the legacy imageUrl for an existing image-only Initiative (test #1, #26)", () => {
    const resolved = resolveInitiativeCoverMedia({ imageUrl: "/api/v1/media/files/initiatives/legacy.jpg" });

    assert.deepEqual(resolved, {
      type: "image",
      url: "/api/v1/media/files/initiatives/legacy.jpg",
      verificationStatus: "approved",
    });
  });

  it("returns undefined when neither coverMedia nor imageUrl is set", () => {
    assert.equal(resolveInitiativeCoverMedia({}), undefined);
  });

  it("returns an approved coverMedia entry with verificationReasonCode stripped (test #18, #28)", () => {
    const coverMedia: InitiativeCoverMedia = {
      type: "video_external",
      url: "https://vimeo.com/12345",
      provider: "vimeo",
      providerVideoId: "12345",
      verificationStatus: "approved",
      verificationReasonCode: "internal-only-should-never-leak",
    };

    const resolved = resolveInitiativeCoverMedia({ coverMedia });

    assert.equal(resolved?.verificationStatus, "approved");
    assert.equal((resolved as Record<string, unknown>).verificationReasonCode, undefined);
    assert.equal(resolved?.url, "https://vimeo.com/12345");
  });

  it("does not publicly return pending coverMedia, falling back to the existing imageUrl (test #17, #20)", () => {
    const coverMedia: InitiativeCoverMedia = {
      type: "image",
      url: "/api/v1/media/files/initiatives/pending.jpg",
      verificationStatus: "pending",
    };

    const resolved = resolveInitiativeCoverMedia({
      coverMedia,
      imageUrl: "/api/v1/media/files/initiatives/previous-approved.jpg",
    });

    assert.equal(resolved?.url, "/api/v1/media/files/initiatives/previous-approved.jpg");
  });

  it("does not publicly return replacement_requested coverMedia (test #19)", () => {
    const coverMedia: InitiativeCoverMedia = {
      type: "image",
      url: "/api/v1/media/files/initiatives/replacement.jpg",
      verificationStatus: "replacement_requested",
    };

    assert.equal(resolveInitiativeCoverMedia({ coverMedia }), undefined);
  });

  it("does not publicly return rejected coverMedia", () => {
    const coverMedia: InitiativeCoverMedia = {
      type: "image",
      url: "/api/v1/media/files/initiatives/rejected.jpg",
      verificationStatus: "rejected",
    };

    assert.equal(resolveInitiativeCoverMedia({ coverMedia }), undefined);
  });
});

describe("parseExternalVideoUrl", () => {
  it("accepts a standard YouTube watch URL (test #13)", () => {
    const parsed = parseExternalVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    assert.deepEqual(parsed, {
      provider: "youtube",
      providerVideoId: "dQw4w9WgXcQ",
      canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
  });

  it("accepts a youtu.be short link", () => {
    const parsed = parseExternalVideoUrl("https://youtu.be/dQw4w9WgXcQ");
    assert.equal(parsed?.provider, "youtube");
    assert.equal(parsed?.providerVideoId, "dQw4w9WgXcQ");
  });

  it("accepts a Vimeo URL", () => {
    const parsed = parseExternalVideoUrl("https://vimeo.com/76979871");
    assert.deepEqual(parsed, {
      provider: "vimeo",
      providerVideoId: "76979871",
      canonicalUrl: "https://vimeo.com/76979871",
    });
  });

  it("rejects an unsupported provider (test #14)", () => {
    assert.equal(parseExternalVideoUrl("https://www.dailymotion.com/video/x123abc"), null);
  });

  it("rejects a non-HTTPS URL (test #15)", () => {
    assert.equal(parseExternalVideoUrl("http://www.youtube.com/watch?v=dQw4w9WgXcQ"), null);
  });

  it("rejects a malformed URL", () => {
    assert.equal(parseExternalVideoUrl("not a url"), null);
  });

  it("rejects an empty string", () => {
    assert.equal(parseExternalVideoUrl(""), null);
  });

  it("rejects a YouTube host with no resolvable video id", () => {
    assert.equal(parseExternalVideoUrl("https://www.youtube.com/"), null);
  });
});

describe("buildExternalVideoEmbedUrl (test #16 — no arbitrary iframe/HTML)", () => {
  it("builds a fixed, privacy-enhanced YouTube embed URL from only provider + id", () => {
    const url = buildExternalVideoEmbedUrl("youtube", "dQw4w9WgXcQ");
    assert.equal(url, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1");
  });

  it("builds a fixed Vimeo embed URL from only provider + id", () => {
    const url = buildExternalVideoEmbedUrl("vimeo", "76979871");
    assert.equal(url, "https://player.vimeo.com/video/76979871?title=0&byline=0");
  });

  it("encodes the video id, never interpolating arbitrary user-supplied markup", () => {
    const url = buildExternalVideoEmbedUrl("youtube", '"><script>alert(1)</script>');
    assert.ok(!url.includes("<script>"));
  });
});

describe("Initiative draft validators — coverMedia (server never trusts client-declared status)", () => {
  const baseInput = {
    title: "Fixture Initiative",
    description: "Fixture description for coverMedia validation tests.",
    activityArea: "Environment and Climate",
  };

  it("re-derives an approved image coverMedia from a platform media URL", () => {
    const result = validateCreateInitiativeDraftInput({
      ...baseInput,
      coverMedia: {
        type: "image",
        url: "/api/v1/media/files/initiatives/abc.png",
        verificationStatus: "approved",
      },
    });

    assert.equal(result.coverMedia?.type, "image");
    assert.equal(result.coverMedia?.verificationStatus, "approved");
  });

  it("rejects an image coverMedia pointing outside platform-hosted media (no arbitrary media hosting)", () => {
    assert.throws(
      () =>
        validateCreateInitiativeDraftInput({
          ...baseInput,
          coverMedia: {
            type: "image",
            url: "https://evil.example.com/payload.png",
            verificationStatus: "approved",
          },
        }),
      /uploaded platform media file/,
    );
  });

  it("ignores a client-forged verificationStatus and re-derives it as approved from a valid link", () => {
    const result = validateCreateInitiativeDraftInput({
      ...baseInput,
      coverMedia: {
        type: "video_external",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        verificationStatus: "rejected", // client cannot force a status either way
        verificationReasonCode: "client-supplied-and-must-be-discarded",
      },
    });

    assert.equal(result.coverMedia?.verificationStatus, "approved");
    assert.equal(result.coverMedia?.provider, "youtube");
    assert.equal((result.coverMedia as Record<string, unknown>).verificationReasonCode, undefined);
  });

  it("rejects an unsupported/malformed external video URL with a clear message", () => {
    assert.throws(
      () =>
        validateCreateInitiativeDraftInput({
          ...baseInput,
          coverMedia: { type: "video_external", url: "https://example.com/not-a-video" },
        }),
      /approved HTTPS YouTube or Vimeo URL/,
    );
  });

  it("rejects raw video upload as cover media (Part 5 — no scanning/transcoding infrastructure yet)", () => {
    assert.throws(
      () =>
        validateCreateInitiativeDraftInput({
          ...baseInput,
          coverMedia: { type: "video_upload", url: "/api/v1/media/files/initiatives/raw.mp4" },
        }),
      /not yet available/,
    );
  });

  it("rejects an unrecognized cover media type", () => {
    assert.throws(
      () =>
        validateCreateInitiativeDraftInput({
          ...baseInput,
          coverMedia: { type: "arbitrary_embed_html", url: "<iframe src=x></iframe>" },
        }),
      /Unsupported cover media type/,
    );
  });

  it("allows omitting coverMedia entirely (backward compatibility, test #1)", () => {
    const result = validateCreateInitiativeDraftInput({ ...baseInput, imageUrl: "/api/v1/media/files/initiatives/legacy.jpg" });
    assert.equal(result.coverMedia, undefined);
    assert.equal(result.imageUrl, "/api/v1/media/files/initiatives/legacy.jpg");
  });

  it("accepts an explicit clearCoverMedia flag on save input (Remove Media action)", () => {
    const result = validateSaveInitiativeDraftInput({ clearCoverMedia: true });
    assert.equal(result.clearCoverMedia, true);
  });

  it("rejects a non-boolean clearCoverMedia value", () => {
    assert.throws(
      () => validateSaveInitiativeDraftInput({ clearCoverMedia: "yes" }),
      /clearCoverMedia must be a boolean/,
    );
  });
});
