/**
 * UX Consistency Pack 09A — Candidate primary button + canonical image input.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webRoot, relativePath), "utf8");
}

describe("UX Consistency Pack 09A — Candidate button + image input", () => {
  it("Submit candidate / Save changes use canonical primary hu-button; pending Saving…", () => {
    const form = readWeb(
      "features/public-choice-candidate/components/PublicChoiceCandidateSubmitPanel.tsx",
    );
    const css = readWeb(
      "features/public-initiative-experience/public-initiative-experience.css",
    );
    assert.match(form, /hu-button hu-button--primary/);
    assert.match(form, /busy \? "Saving…" : isEdit \? "Save changes" : "Submit candidate"/);
    assert.doesNotMatch(
      css,
      /\.pie-election-candidate-submit button\s*\{[^}]*background:\s*var\(--hu-color-surface\)/,
    );
    assert.match(css, /do NOT restyle \.hu-button/);
  });

  it("Candidate photo uses PersonImageUploadField person preview pattern", () => {
    const form = readWeb(
      "features/public-choice-candidate/components/PublicChoiceCandidateSubmitPanel.tsx",
    );
    const person = readWeb("features/media-upload/components/PersonImageUploadField.tsx");
    const mediaCss = readWeb("features/media-upload/components/media-image-upload-field.css");
    assert.match(form, /PersonImageUploadField/);
    assert.match(form, /variant="person"/);
    assert.match(form, /uploadInitiativeImage/);
    assert.match(person, /media-image-upload-field__preview--person/);
    assert.match(person, /object-fit|media-image-upload-field__image/);
    assert.match(person, /Replace photo|replaceLabel/);
    assert.match(person, /Uploading photo/);
    assert.match(mediaCss, /preview--person/);
    assert.match(mediaCss, /preview--landscape/);
    assert.match(mediaCss, /margin-inline:\s*auto/);
  });

  it("Profile avatar and Initiative cover remain on canonical media APIs / patterns", () => {
    const avatar = readWeb("features/media-upload/components/AvatarImageUploadField.tsx");
    const cover = readWeb("features/media-upload/components/InitiativeCoverMediaField.tsx");
    const coverCss = readWeb("features/media-upload/components/initiative-cover-media-field.css");
    assert.match(avatar, /AvatarCropEditor/);
    assert.match(avatar, /media-image-upload-field__preview--avatar/);
    assert.match(avatar, /hu-button hu-button--secondary/);
    assert.match(cover, /aspect-ratio|initiative-cover-media-field__preview/);
    assert.match(cover, /hu-button hu-button--secondary/);
    assert.match(coverCss, /aspect-ratio:\s*16\s*\/\s*9/);
    assert.match(coverCss, /margin-inline:\s*auto/);
  });
});
