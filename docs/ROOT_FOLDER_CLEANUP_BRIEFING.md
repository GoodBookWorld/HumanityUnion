# Root Folder Cleanup Briefing

Audit date: 2026-07-09 (TASK-076)

## Summary

Seven empty directories exist at the repository root. None are referenced by the active monorepo layout (`apps/web`, `apps/api`, `packages/`). They appear to be scaffolding placeholders from early project setup.

## Audited folders

| Folder        | Contents | Referenced by codebase | Recommendation                                                                                                                                                                                     |
| ------------- | -------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/` | Empty    | No                     | **Safe to delete** after confirming no external docs link to it. Active UI lives in `apps/web/src/components/` and `apps/web/src/design-system/`.                                                  |
| `database/`   | Empty    | No                     | **Safe to delete.** MongoDB config and adapters live under `apps/api/src/modules/`.                                                                                                                |
| `management/` | Empty    | No                     | **Safe to delete.** No management tooling exists at root.                                                                                                                                          |
| `pages/`      | Empty    | No                     | **Safe to delete.** Next.js App Router uses `apps/web/src/app/` (not Pages Router).                                                                                                                |
| `public/`     | Empty    | No                     | **Safe to delete.** Static assets live in `apps/web/public/`.                                                                                                                                      |
| `scripts/`    | Empty    | No                     | **Safe to delete.** Verification and API scripts live in `apps/api/src/scripts/` and `apps/web/src/scripts/`.                                                                                      |
| `tests/`      | Empty    | No                     | **Keep or repurpose.** If end-to-end tests are planned at repo root, retain with a `README.md` pointing to `apps/api/src/scripts/verify-*` as the current verification baseline. Otherwise delete. |

## Active equivalents

- Web UI components: `apps/web/src/components/`, `apps/web/src/design-system/`, `apps/web/src/features/`
- Static assets / favicon: `apps/web/public/`
- Verification scripts: root `package.json` scripts → `apps/api/src/scripts/`
- Database: `apps/api/src/modules/*/persistence/`

## Recommended action

1. Delete the six clearly obsolete folders (`components`, `database`, `management`, `pages`, `public`, `scripts`).
2. Either delete `tests/` or add `tests/README.md` explaining that verification currently runs via `npm run verify:*` scripts.
3. Do **not** recreate root-level mirrors of monorepo paths — document the layout in `README.md` instead.

No deletions were performed in TASK-076 per scope ("do not delete unless unused" — documented here for a follow-up cleanup PR).
