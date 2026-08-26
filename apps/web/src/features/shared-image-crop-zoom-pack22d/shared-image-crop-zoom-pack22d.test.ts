/**
 * Pack 22D — Shared image crop / position / centered zoom for Profile + Initiative Cover.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  AVATAR_CROP_OUTPUT_SIZE,
  AVATAR_CROP_VIEWPORT_SIZE,
  createDefaultAvatarCropTransform,
} from "../media-upload/avatar-crop.js";
import {
  INITIATIVE_COVER_CROP_FRAME,
  INITIATIVE_COVER_OUTPUT_HEIGHT,
  INITIATIVE_COVER_OUTPUT_WIDTH,
  createDefaultInitiativeCoverCropTransform,
} from "../media-upload/initiative-cover-crop.js";
import {
  IMAGE_CROP_DEFAULT_ZOOM_FACTOR,
  IMAGE_CROP_MAX_ZOOM_FACTOR,
  centerImageCropTransform,
  centeredZoomSliderFromScale,
  clampImageCropTransform,
  computeCoverMinScale,
  createDefaultImageCropTransform,
  imageCropFullyCoversFrame,
  isCenteredZoomMidpointDefault,
  normalizeImageCropPosition,
  resolveImageCropZoomRange,
  scaleFromCenteredZoomSlider,
} from "../media-upload/image-crop-zoom.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("Pack 22D — shared image crop / centered zoom", () => {
  const avatarFrame = { width: AVATAR_CROP_VIEWPORT_SIZE, height: AVATAR_CROP_VIEWPORT_SIZE };
  const coverFrame = INITIATIVE_COVER_CROP_FRAME;

  it("1. shared crop/zoom model is reused by Profile and Initiative Cover", () => {
    const shared = readWeb("features/media-upload/image-crop-zoom.ts");
    const editor = readWeb("features/media-upload/components/ImageCropZoomEditor.tsx");
    const avatarEditor = readWeb("features/media-upload/components/AvatarCropEditor.tsx");
    const coverField = readWeb("features/media-upload/components/InitiativeCoverMediaField.tsx");
    const avatarCrop = readWeb("features/media-upload/avatar-crop.ts");
    const coverCrop = readWeb("features/media-upload/initiative-cover-crop.ts");

    assert.match(shared, /scaleFromCenteredZoomSlider/);
    assert.match(shared, /resolveImageCropZoomRange/);
    assert.match(editor, /from "\.\.\/image-crop-zoom"/);
    assert.match(avatarEditor, /ImageCropZoomEditor/);
    assert.match(coverField, /ImageCropZoomEditor/);
    assert.match(avatarCrop, /createDefaultImageCropTransform|renderImageCropBlob/);
    assert.match(coverCrop, /createDefaultImageCropTransform|renderImageCropBlob/);
  });

  it("2–4. slider midpoint equals default; left decreases; right increases", () => {
    const range = resolveImageCropZoomRange(1200, 800, avatarFrame);
    assert.equal(isCenteredZoomMidpointDefault(range), true);
    assert.equal(scaleFromCenteredZoomSlider(0.5, range), range.defaultScale);
    assert.ok(scaleFromCenteredZoomSlider(0, range) < range.defaultScale);
    assert.ok(scaleFromCenteredZoomSlider(1, range) > range.defaultScale);
    assert.equal(scaleFromCenteredZoomSlider(0, range), range.minScale);
    assert.equal(scaleFromCenteredZoomSlider(1, range), range.maxScale);
    assert.equal(centeredZoomSliderFromScale(range.defaultScale, range), 0.5);
    assert.ok(centeredZoomSliderFromScale(range.minScale, range) < 0.5);
    assert.ok(centeredZoomSliderFromScale(range.maxScale, range) > 0.5);
  });

  it("5. minimum zoom never exposes invalid empty crop", () => {
    const cases = [
      { w: 1200, h: 800, frame: avatarFrame },
      { w: 400, h: 1200, frame: avatarFrame },
      { w: 1600, h: 900, frame: coverFrame },
      { w: 900, h: 1600, frame: coverFrame },
      { w: 128, h: 128, frame: avatarFrame },
    ];
    for (const c of cases) {
      const range = resolveImageCropZoomRange(c.w, c.h, c.frame);
      assert.equal(range.minScale, computeCoverMinScale(c.w, c.h, c.frame));
      assert.ok(range.minScale < range.defaultScale);
      assert.ok(range.defaultScale < range.maxScale);
      assert.equal(range.defaultScale, range.minScale * IMAGE_CROP_DEFAULT_ZOOM_FACTOR);
      assert.equal(range.maxScale, range.minScale * IMAGE_CROP_MAX_ZOOM_FACTOR);

      const atMin = clampImageCropTransform(
        c.w,
        c.h,
        c.frame,
        { scale: range.minScale * 0.5, offsetX: 999, offsetY: -999 },
        range,
      );
      assert.equal(atMin.scale, range.minScale);
      assert.equal(imageCropFullyCoversFrame(c.w, c.h, c.frame, atMin), true);

      const defaults = createDefaultImageCropTransform(c.w, c.h, c.frame);
      assert.equal(imageCropFullyCoversFrame(c.w, c.h, c.frame, defaults), true);
    }
  });

  it("6. drag updates normalized position", () => {
    const w = 1000;
    const h = 800;
    const range = resolveImageCropZoomRange(w, h, avatarFrame);
    const centered = createDefaultImageCropTransform(w, h, avatarFrame);
    const mid = normalizeImageCropPosition(w, h, avatarFrame, centered);
    assert.ok(Math.abs(mid.x - 0.5) < 1e-6);
    assert.ok(Math.abs(mid.y - 0.5) < 1e-6);

    const dragged = clampImageCropTransform(
      w,
      h,
      avatarFrame,
      { ...centered, offsetX: centered.offsetX - 40, offsetY: centered.offsetY - 20 },
      range,
    );
    const next = normalizeImageCropPosition(w, h, avatarFrame, dragged);
    assert.notEqual(next.x, mid.x);
    assert.ok(next.x >= 0 && next.x <= 1);
    assert.ok(next.y >= 0 && next.y <= 1);
    assert.equal(imageCropFullyCoversFrame(w, h, avatarFrame, dragged), true);
  });

  it("7–8. Profile + Initiative Cover crop state persists via baked upload on save", () => {
    const avatarField = readWeb("features/media-upload/components/AvatarImageUploadField.tsx");
    const coverField = readWeb("features/media-upload/components/InitiativeCoverMediaField.tsx");
    assert.match(avatarField, /handleCropSave/);
    assert.match(avatarField, /onUpload\(avatarCropBlobToFile\(blob\)\)/);
    assert.match(avatarField, /AvatarCropEditor/);
    assert.match(coverField, /handleCropSave/);
    assert.match(coverField, /onImageUpload\(initiativeCoverCropBlobToFile\(blob\)\)/);
    assert.match(coverField, /ImageCropZoomEditor/);
    assert.equal(AVATAR_CROP_OUTPUT_SIZE, 512);
    assert.equal(INITIATIVE_COVER_OUTPUT_WIDTH / INITIATIVE_COVER_OUTPUT_HEIGHT, 16 / 9);
  });

  it("9. legacy records without crop metadata use deterministic defaults", () => {
    const avatarDefault = createDefaultAvatarCropTransform(800, 600, AVATAR_CROP_VIEWPORT_SIZE);
    const coverDefault = createDefaultInitiativeCoverCropTransform(1600, 900);
    const avatarRange = resolveImageCropZoomRange(800, 600, avatarFrame);
    const coverRange = resolveImageCropZoomRange(1600, 900, coverFrame);
    assert.equal(avatarDefault.scale, avatarRange.defaultScale);
    assert.equal(coverDefault.scale, coverRange.defaultScale);
    const avatarCentered = centerImageCropTransform(
      800,
      600,
      avatarFrame,
      avatarRange.defaultScale,
    );
    assert.deepEqual(avatarDefault, avatarCentered);
  });

  it("10–11. public rendering respects saved crop via baked media URL + object-fit", () => {
    const avatarField = readWeb("features/media-upload/components/AvatarImageUploadField.tsx");
    const coverField = readWeb("features/media-upload/components/InitiativeCoverMediaField.tsx");
    const coverCss = readWeb("features/media-upload/components/initiative-cover-media-field.css");
    const mediaCss = readWeb("features/media-upload/components/media-image-upload-field.css");
    assert.match(avatarField, /imageUrl/);
    assert.match(avatarField, /media-image-upload-field__image/);
    assert.match(coverField, /coverMedia\.url/);
    assert.match(coverCss, /object-fit:\s*cover/);
    assert.match(coverCss, /aspect-ratio:\s*16\s*\/\s*9/);
    assert.match(mediaCss, /preview--avatar|object-fit/);
  });

  it("12. different aspect ratios supported", () => {
    const avatarAspect = avatarFrame.width / avatarFrame.height;
    const coverAspect = coverFrame.width / coverFrame.height;
    assert.equal(avatarAspect, 1);
    assert.equal(coverAspect, 16 / 9);
    const avatarEditor = readWeb("features/media-upload/components/AvatarCropEditor.tsx");
    const coverField = readWeb("features/media-upload/components/InitiativeCoverMediaField.tsx");
    assert.match(avatarEditor, /mask="circle"/);
    assert.match(coverField, /mask="rect"/);
    assert.match(coverField, /INITIATIVE_COVER_CROP_FRAME/);
  });

  it("13. Reset returns position center + default zoom", () => {
    const editor = readWeb("features/media-upload/components/ImageCropZoomEditor.tsx");
    assert.match(editor, /\bReset\b/);
    assert.match(editor, /centerImageCropTransform/);
    assert.match(editor, /range\.defaultScale/);
  });

  it("14. keyboard slider + crop nudge behavior", () => {
    const editor = readWeb("features/media-upload/components/ImageCropZoomEditor.tsx");
    assert.match(editor, /type="range"/);
    assert.match(editor, />Zoom</);
    assert.match(editor, /ArrowLeft/);
    assert.match(editor, /ArrowRight/);
    assert.match(editor, /ArrowUp/);
    assert.match(editor, /ArrowDown/);
    assert.match(editor, /nudgeTransform/);
  });

  it("15. mobile layout remains usable", () => {
    const css = readWeb("features/media-upload/components/image-crop-zoom-editor.css");
    assert.match(css, /max-width:\s*100%/);
    assert.match(css, /touch-action:\s*none/);
    assert.match(css, /@media \(max-width:\s*768px\)/);
    assert.ok(coverFrame.width <= 320);
  });

  it("16. no repeated upload during drag/zoom", () => {
    const editor = readWeb("features/media-upload/components/ImageCropZoomEditor.tsx");
    const avatarField = readWeb("features/media-upload/components/AvatarImageUploadField.tsx");
    const coverField = readWeb("features/media-upload/components/InitiativeCoverMediaField.tsx");
    const moveStart = editor.indexOf("function handlePointerMove");
    const saveStart = editor.indexOf("async function handleSave");
    const scaleStart = editor.indexOf("function updateScaleFromSlider");
    assert.ok(moveStart > 0 && saveStart > moveStart);
    assert.doesNotMatch(editor.slice(moveStart, saveStart), /onSave/);
    assert.doesNotMatch(editor.slice(scaleStart, moveStart), /onSave/);
    assert.match(editor.slice(saveStart), /await onSave\(blob\)/);
    assert.match(avatarField, /async function handleCropSave/);
    assert.match(coverField, /async function handleCropSave/);
    assert.match(coverField, /onImageUpload\(initiativeCoverCropBlobToFile\(blob\)\)/);
    assert.doesNotMatch(coverField, /await onImageUpload\(file\)/);
  });

  it("17. Blog media code remains unchanged by Pack 22D wiring", () => {
    const rich = readWeb("features/blog/components/BlogRichTextEditorClient.tsx");
    const cover = readWeb("features/blog/components/BlogCoverField.tsx");
    assert.doesNotMatch(rich, /ImageCropZoomEditor|image-crop-zoom/);
    assert.doesNotMatch(cover, /ImageCropZoomEditor|image-crop-zoom/);
    assert.match(rich, /ImageResize/);
  });

  it("18–19. Profile + Initiative Cover editors keep Reset / Zoom a11y contracts", () => {
    const editor = readWeb("features/media-upload/components/ImageCropZoomEditor.tsx");
    assert.match(editor, /aria-label=\{ariaLabel\}/);
    assert.match(editor, /aria-valuetext/);
    assert.match(editor, /role="dialog"/);
    assert.match(editor, /tabIndex=\{0\}/);
  });
});
