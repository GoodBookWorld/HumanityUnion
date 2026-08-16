# STAGING FEATURE RECONCILIATION PACK 05 — Assessment (concise)

## Allies

- Canonical collection: `initiative_allies` (`initiativeId` + `participantId` + status).
- Active Allies: **derived** — Author/steward projection + rows with `status === "active"`. Author is not counted in `activeAlliesCount`.
- Scoped historical: 6 allies (Mind-Safe 3, Isabella 3); 5 active; collaboration messages 4; reads 8; sessions 0.
- Restore via portable bundle + `pnpm reconcile:staging-historical-data` (dry-run default).

## RSS /media

- Root cause: staging `public_news_articles` empty; UI already wired (`fetchPublicNewsArticles`).
- Strategy: **re_ingest_from_configured_sources** (`NEWS_PROVIDER_ENABLED=true` + refresh). Do not migrate expired article dump.

## UI

- Public hero: 50/50 media|title+meta columns; description full-width below.
- Mini/world/country cards: whole-card Link to canonical public Initiative href.

## Operator (verified)

Pack 05 deployed; reconcile `--execute` completed; `pnpm verify:staging -- --check-media-http` → **PASS**.

`NEWS_PROVIDER_ENABLED=true` on staging API; RSS ingestion operational (16 sources; news article count is a verification snapshot, not an invariant).

Historical staging recovery approved scope (Packs 01–05): **CLOSED**. Next: Lifecycle UX current-state audit — see `project/NEXT_SESSION.md`.
