# Production configuration checklist (Pack 01)

Operator actions only — do **not** change Render from Cursor. Apply these in the Render dashboard (or equivalent) after code is deployed.

## API production

Set:

- `PLATFORM_MODE=production`
- `ALLOW_PUBLIC_REGISTRATION=true`

Expected effects:

- Public registration no longer requires a Beta Invite field.
- Email verification, password rules, and rate-limit security remain enforced.
- Platform readiness / indexing policy aligns with production mode on the API side.

## Web production

Set:

- `NEXT_PUBLIC_PLATFORM_MODE=production`
- `NEXT_PUBLIC_SITE_URL=<canonical public origin>` (required for sitemap, canonicals, and clearing “public site origin missing”)

Then rebuild/redeploy Web so the public env is baked into the client bundle.

Expected effects:

- Indexing is allowed (`shouldDisallowSearchIndexing` → false).
- “Indexing unexpectedly disabled” / “Indexing mode inconsistent” clear when API `PLATFORM_MODE=production` and Web mode match.
- Indexing warnings clear after Web rebuild when site origin is also configured.
- Production robots / indexing become consistent with API `PLATFORM_MODE=production`.

## AI (optional)

- Do **not** require `AI_API_KEY` for production cutover.
- Admin Platform may show AI as **Disabled (optional)** when no provider key is configured.
- That state is acceptable and is not a launch blocker.

## After apply

1. Confirm public registration UI no longer requires invite codes.
2. Confirm `/admin/platform` readiness warnings related to indexing clear after Web rebuild.
3. Confirm `/admin/diagnostics` shows Mongo / Email / Outbox from the authenticated Admin health surface (not UNKNOWN solely due to public `/health` redaction).
