# WordPress → New Platform Redirect Inventory (Pack 26A)

**Status:** preparation only — **do not** implement DNS / 301 redirects in this pack.

This inventory lists repository-known legacy `huws.org` WordPress paths and any known
canonical new-platform routes. Use it as the input for a later production cutover redirect map.

## Legend

| Status | Meaning |
|---|---|
| `REDIRECT_READY` | Canonical new-platform route is known and safe to 301 |
| `NEEDS_MAPPING` | Legacy path is referenced; no equivalent new route confirmed |
| `KEEP_TEMPORARILY` | Keep WordPress URL temporarily (content still useful; no internal replacement yet) |
| `RETIRE` | Path should be retired after cutover (no redirect target needed / intentional drop) |

## Inventory

| Legacy path / URL | Intended canonical new route | Status | Evidence / notes |
|---|---|---|---|
| `/regional-program/` (`https://huws.org/regional-program/`) | _(none confirmed)_ | `KEEP_TEMPORARILY` / `NEEDS_MAPPING` | Public Support CTA (`SUPPORT_REGIONAL_PROGRAM_URL`) still points here. No equivalent `apps/web` route for Regional Program exists. **Remaining WordPress cutover dependency.** |
| Organization site root / marketing (`https://www.huws.org`, `https://huws.org`) | `https://huws.org` (new Web) | `NEEDS_MAPPING` | Footer `ORGANIZATION_WEBSITE`; apex cutover is a later infrastructure pack. |
| Brand email logo path (`https://huws.org/brand/humanity-union-logo-white-email.png`) | Prefer Web-hosted brand asset on new origin | `NEEDS_MAPPING` | Referenced in email ops docs; ensure asset is hosted on the new Web before retiring WP media. |
| Contact mailbox (`info@huws.org`) | _(email, not HTTP)_ | `KEEP_TEMPORARILY` | Not a page redirect; mailbox remains operational independently of WordPress. |

## Explicit non-findings

- No other `huws.org/...` **content page** paths were found in `apps/web` source beyond Regional Program and brand/footer references above.
- Do **not** guess mappings for undocumented historical WP permalinks.

## Next pack (out of scope here)

1. Confirm Regional Program content migration or permanent external keep.
2. Publish a full 301 map (including `www` → apex) at DNS/CDN/Nginx layer.
3. Retire WordPress only after redirects + asset hosting are verified.
