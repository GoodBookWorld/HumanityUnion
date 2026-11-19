/**
 * HU-LEGAL-EDITOR-01B — Legal HTML sanitizer unit tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isSafeLegalHref,
  legalHtmlToPlainText,
  sanitizeLegalHtml,
  sanitizeLegalHtmlDetailed,
} from "../../../src/modules/legal-localization/legal-content-sanitize.js";

describe("HU-LEGAL-EDITOR-01B — legal-content-sanitize", () => {
  it("round-trips allowed legal markup and preserves visible Ukrainian text", () => {
    const input = [
      "<section>",
      "<h2>1. Хто ми</h2>",
      "<p>Ми <strong>Humanity Union</strong>.</p>",
      "<h3>1.1 Контакт</h3>",
      "<p>Пишіть на <a href=\"mailto:privacy@example.com\">privacy@example.com</a>.</p>",
      "<ul><li>Один</li><li><em>Два</em></li><li><u>Три</u></li></ul>",
      "<ol><li>Перший</li><li>Другий</li></ol>",
      "<p>Рядок<br />з переносом</p>",
      "</section>",
    ].join("");

    const result = sanitizeLegalHtmlDetailed(input);
    assert.equal(result.preservedVisibleText, true);
    assert.match(result.html, /<h2>1\. Хто ми<\/h2>/);
    assert.match(result.html, /<strong>Humanity Union<\/strong>/);
    assert.match(result.html, /mailto:privacy@example.com/);
    assert.match(result.html, /<ol>/);
    assert.equal(
      legalHtmlToPlainText(result.html),
      legalHtmlToPlainText(input),
    );
  });

  it("strips scripts, event handlers, iframes, and unsafe URLs without dropping link text", () => {
    const input =
      '<p>Hello<script>alert(1)</script></p><p><a href="javascript:alert(1)">Click</a></p>' +
      '<p onclick="evil()">Safe</p><iframe src="https://evil.example"></iframe>';

    const result = sanitizeLegalHtmlDetailed(input);
    assert.doesNotMatch(result.html, /script|iframe|onclick|javascript:/i);
    assert.match(result.html, /Click/);
    assert.match(result.html, /Safe/);
    assert.equal(result.preservedVisibleText, true);
  });

  it("rejects data and vbscript hrefs", () => {
    assert.equal(isSafeLegalHref("https://example.com/a"), true);
    assert.equal(isSafeLegalHref("/privacy"), true);
    assert.equal(isSafeLegalHref("#section-1"), true);
    assert.equal(isSafeLegalHref("mailto:a@b.c"), true);
    assert.equal(isSafeLegalHref("javascript:alert(1)"), false);
    assert.equal(isSafeLegalHref("data:text/html,hi"), false);
    assert.equal(isSafeLegalHref("vbscript:msgbox"), false);
  });

  it("unwraps unknown tags and drops style/class attributes", () => {
    const input =
      '<div class="x" style="color:red"><p style="margin:0" class="y">Body <b>bold</b></p></div>';
    const html = sanitizeLegalHtml(input);
    assert.doesNotMatch(html, /style=|class=|<div|<b>/i);
    assert.match(html, /<p>Body <strong>bold<\/strong><\/p>/);
    assert.equal(legalHtmlToPlainText(html), "Body bold");
  });

  it("normalizes NBSP artifacts from editor empty paragraphs", () => {
    const html = sanitizeLegalHtml("<p>&nbsp;</p><p>Keep</p>");
    assert.doesNotMatch(html, /&nbsp;|&amp;nbsp;/i);
    assert.match(html, /Keep/);
  });

  it("does not allow images or tables", () => {
    const html = sanitizeLegalHtml(
      '<p>Text</p><img src="https://evil/x.png" alt="X" /><table><tr><td>Cell</td></tr></table>',
    );
    assert.doesNotMatch(html, /<img|<table|<td/i);
    assert.match(html, /Text/);
    assert.match(html, /Cell/);
  });
});
