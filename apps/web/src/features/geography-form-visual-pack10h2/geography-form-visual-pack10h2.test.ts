/**
 * Pack 10H2 — Geography form visual hierarchy & control consistency.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { GEOGRAPHY_EMPTY_COPY } from "../geography-integrity/geography-cascade-contract";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("Pack 10H2 — geography form visual hierarchy", () => {
  it("shared geography CSS distinguishes label / helper / error / trigger / search", () => {
    const css = readWeb("design-system/components/geography-search-select.css");
    assert.match(css, /\.geography-search-select__label/);
    assert.match(css, /\.geography-search-select__helper/);
    assert.match(css, /\.geography-search-select__error/);
    assert.match(css, /--hu-color-danger/);
    assert.match(css, /\.geography-search-select__trigger--filled/);
    assert.match(css, /\.geography-search-select__search-icon/);
    assert.match(css, /\.geography-search-select__chevron/);
    assert.match(css, /\.geography-multi-select__chip/);
    assert.match(css, /--hu-color-primary-soft/);
  });

  it("GeographySearchSelect is one combobox trigger plus optional in-panel filter", () => {
    const select = readWeb("design-system/components/GeographySearchSelect.tsx");
    assert.match(select, /geography-search-select__trigger/);
    assert.match(select, /geography-search-select__search-wrap/);
    assert.match(select, /Filter \$\{label\}/);
    assert.match(select, /hu-visually-hidden/);
    assert.doesNotMatch(select, /geography-search-select__selected/);
  });

  it("city search placeholder invites optional filtering", () => {
    assert.equal(GEOGRAPHY_EMPTY_COPY.citySearchPlaceholder, "Search cities or communities…");
  });

  it("/search uses hu-form-control and does not override hu-button--primary", () => {
    const page = readWeb("features/global-search/components/GlobalSearchPageContent.tsx");
    const css = readWeb("features/global-search/global-search-page.css");
    assert.match(page, /className="hu-form-control"/);
    assert.match(page, /variant="primary"/);
    assert.match(page, /global-search-page__actions/);
    assert.doesNotMatch(css, /\.global-search-page__filters button\s*\{/);
    assert.match(css, /do not restyle design-system buttons/i);
    assert.match(css, /\.global-search-page__actions/);
  });

  it("Country Search Clear Filters stays secondary to primary Search", () => {
    const page = readWeb(
      "features/country-experience/components/CountryExperienceDynamicPage.tsx",
    );
    const css = readWeb("features/country-experience/country-experience-dynamic.css");
    assert.match(page, /hu-button hu-button--primary/);
    assert.match(page, /Clear Filters/);
    assert.match(css, /country-experience-dynamic__clear-filters/);
    assert.match(css, /geography-search-select__trigger/);
  });

  it("Preferences chips and region selections use chip surfaces", () => {
    const preferredCss = readWeb("features/preferences/components/preferences-workspace.css");
    const geoCss = readWeb("design-system/components/geography-search-select.css");
    assert.match(preferredCss, /preferences-workspace__region-list/);
    assert.match(preferredCss, /--hu-color-primary-soft/);
    assert.match(geoCss, /geography-multi-select__chips/);
    assert.match(geoCss, /geography-multi-select__chip/);
  });

  it("Participation Area and Initiative keep shared geography control family", () => {
    const participation = readWeb(
      "features/participation-area/components/participation-area-section.css",
    );
    const initiative = readWeb("features/initiatives/components/initiative-form-fields.css");
    assert.match(participation, /geography-search-select__trigger/);
    assert.match(initiative, /hu-form-control/);
  });

  it("design-system form control family includes geography trigger", () => {
    const components = readWeb("design-system/components.css");
    assert.match(components, /geography-search-select__trigger/);
    assert.match(components, /geography-search-select__trigger:disabled/);
  });
});
