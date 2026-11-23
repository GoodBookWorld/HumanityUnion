/**
 * HU-LOC-BRAND-01E — Admin preview and confirmation for selected WEB_UI updates.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  formatSelectedWebUiUpdatePreviewMessage,
  selectedWebUiUpdatePreviewCanApply,
} from "./admin-languages-api";

const here = path.dirname(fileURLToPath(import.meta.url));

describe("Admin WEB_UI update selected translations", () => {
  it("formats the preview and withholds confirmation when validation fails", () => {
    const preview = {
      locale: "ka",
      currentRevision: 5,
      packStatus: "published" as const,
      selectedKeyCount: 1,
      entries: [
        {
          path: "auth.loginSubtitle",
          existingValue: "old {siteName}",
          proposedValue: "Access your {siteName} workspace.",
          errors: [],
        },
      ],
      validationErrors: [],
    };
    const message = formatSelectedWebUiUpdatePreviewMessage(preview);
    assert.match(message, /ka/);
    assert.match(message, /Current revision: 5/);
    assert.match(message, /Selected keys: 1/);
    assert.match(message, /auth\.loginSubtitle/);
    assert.match(message, /Existing: old \{siteName\}/);
    assert.match(message, /Proposed: Access your \{siteName\} workspace\./);
    assert.equal(selectedWebUiUpdatePreviewCanApply(preview), true);
    assert.equal(
      selectedWebUiUpdatePreviewCanApply({
        ...preview,
        entries: [
          {
            path: "auth.loginSubtitle",
            existingValue: "old {siteName}",
            proposedValue: "Access your {siteName} workspace.",
            errors: ["Unknown key path."],
          },
        ],
      }),
      false,
    );
  });

  it("requires an explicit preview and confirmation before any update", () => {
    const api = readFileSync(path.join(here, "admin-languages-api.ts"), "utf8");
    assert.match(api, /update-selected-from-packaged\/preview/);
    assert.match(api, /update-selected-from-packaged/);
    assert.match(api, /expectedRevision: input\.expectedRevision/);
    assert.doesNotMatch(api, /gemini|TranslationProvider/);

    const section = readFileSync(path.join(here, "components/AdminLanguagesSection.tsx"), "utf8");
    assert.match(section, /Preview selected translations/);
    assert.match(section, /Update selected translations/);
    assert.match(section, /previewAdminUpdateSelectedWebUiFromPackaged/);
    assert.match(section, /applyAdminUpdateSelectedWebUiFromPackaged/);
    assert.match(section, /window\.confirm/);
    assert.match(section, /selectedWebUiUpdatePreviewCanApply/);
    assert.match(section, /Add missing translations/);
    assert.doesNotMatch(
      section,
      /useEffect\(\(\) => \{[\s\S]{0,400}applyAdminUpdateSelectedWebUiFromPackaged/,
    );
  });
});
