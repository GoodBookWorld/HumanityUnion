/**
 * Pack 22C.1 — sanitizer contracts for CKEditor image styles + % resize.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sanitizeBlogHtml } from "../../../src/modules/blog/blog-content-sanitize.js";

const SRC = "/api/v1/media/files/blog/demo.webp";

describe("Pack 22C.1 — image style / resize sanitize contracts", () => {
  for (const style of [
    "image-style-align-left",
    "image-style-align-right",
    "image-style-align-center",
    "image-style-block",
    "image-style-side",
    "image-style-inline",
  ]) {
    it(`${style} survives sanitize`, () => {
      const html = sanitizeBlogHtml(
        `<figure class="image ${style}"><img src="${SRC}" alt="Demo" /><figcaption>Caption</figcaption></figure>`,
      );
      assert.match(html, new RegExp(`class="image ${style}"`));
      assert.match(html, /alt="Demo"/);
      assert.match(html, /<figcaption>Caption<\/figcaption>/);
    });
  }

  it("percentage width + image_resized survives sanitizer", () => {
    const html = sanitizeBlogHtml(
      `<figure class="image image_resized image-style-align-center" style="width: 42%;"><img src="${SRC}" alt="Wide" /></figure>`,
    );
    assert.match(html, /image_resized/);
    assert.match(html, /image-style-align-center/);
    assert.match(html, /width:\s*42%/);
  });

  it("inline resized icon percentage survives", () => {
    const html = sanitizeBlogHtml(
      `<p>Before <img class="image-style-inline image_resized" src="${SRC}" alt="" style="width: 12%;" /> after</p>`,
    );
    assert.match(html, /image-style-inline/);
    assert.match(html, /image_resized/);
    assert.match(html, /width:\s*12%/);
    assert.match(html, /alt=""/);
  });

  it("pixel width remains rejected; width/height attrs stripped", () => {
    const html = sanitizeBlogHtml(
      `<img src="${SRC}" alt="x" width="400" height="200" style="width: 400px;" />`,
    );
    assert.doesNotMatch(html, /400px/);
    assert.doesNotMatch(html, /\bwidth="/);
    assert.doesNotMatch(html, /\bheight="/);
    assert.match(html, /alt="x"/);
  });

  it("existing Blog image HTML regression (center + caption)", () => {
    const html = sanitizeBlogHtml(
      [
        '<figure class="image image-style-align-center" style="width: 80%;">',
        `<img src="https://cdn.example/x.jpg" alt="Inline alt" />`,
        "<figcaption>A caption</figcaption>",
        "</figure>",
      ].join(""),
    );
    assert.match(html, /image-style-align-center/);
    assert.match(html, /width:\s*80%/);
    assert.match(html, /alt="Inline alt"/);
    assert.match(html, /figcaption/);
  });

  it("does not expand sanitizer for GIF or arbitrary classes", () => {
    const withWidget = sanitizeBlogHtml(
      `<figure class="image image-style-align-left ck-widget"><img src="${SRC}" alt="a" /></figure>`,
    );
    assert.doesNotMatch(withWidget, /image-style-align-left/);
    assert.doesNotMatch(withWidget, /ck-widget/);
  });

  for (const style of ["image-style-block-align-left", "image-style-block-align-right"]) {
    it(`${style} survives with caption, alt, and a safe image link`, () => {
      const html = sanitizeBlogHtml(
        `<figure class="image image_resized ${style}" style="width: 25%;"><a href="https://example.com/story" target="_blank"><img src="${SRC}" alt="Placed" /></a><figcaption>Caption</figcaption></figure>`,
      );
      assert.match(html, new RegExp(`class="image image_resized ${style}"`));
      assert.match(html, /width:\s*25%/);
      assert.match(html, /href="https:\/\/example\.com\/story"/);
      assert.doesNotMatch(html, /target=/);
      assert.match(html, /alt="Placed"/);
      assert.match(html, /<figcaption>Caption<\/figcaption>/);
    });
  }

  it("rejects an unsafe image link and an unapproved alignment class", () => {
    const unsafe = sanitizeBlogHtml(
      `<figure class="image image-style-block-align-left"><a href="javascript:alert(1)"><img src="${SRC}" alt="X" /></a></figure>`,
    );
    assert.doesNotMatch(unsafe, /javascript:/i);
    assert.match(unsafe, /alt="X"/);

    const unknown = sanitizeBlogHtml(
      `<figure class="image image-style-block-align-center"><img src="${SRC}" alt="Y" /></figure>`,
    );
    assert.doesNotMatch(unknown, /image-style-block-align/);
    assert.match(unknown, /alt="Y"/);
  });

  it("keeps previously stored wrap, center, and unstyled figures", () => {
    const html = sanitizeBlogHtml(
      [
        `<figure class="image image_resized image-style-align-left" style="width: 35%;"><img src="${SRC}" alt="Wrap" /></figure>`,
        `<figure class="image image-style-align-center" style="width: 80%;"><img src="${SRC}" alt="Center" /><figcaption>Old</figcaption></figure>`,
        `<figure class="image"><img src="${SRC}" alt="Plain" /></figure>`,
        `<figure class="image image-style-block"><img src="${SRC}" alt="Full" /></figure>`,
      ].join(""),
    );
    assert.match(html, /image-style-align-left/);
    assert.match(html, /width:\s*35%/);
    assert.match(html, /image-style-align-center/);
    assert.match(html, /width:\s*80%/);
    assert.match(html, /<figcaption>Old<\/figcaption>/);
    assert.match(html, /<figure class="image"><img src="[^"]+" alt="Plain"/);
    assert.match(html, /image-style-block"/);
    assert.doesNotMatch(html, /image-style-block-align/);
  });
});
