# Favicon and brand icon assets

Humanity Union web assets live under `apps/web/public/` and may also be referenced from App Router metadata.

## Recommended files

| File                            | Size    | Purpose                               |
| ------------------------------- | ------- | ------------------------------------- |
| `brand/favicon.ico`             | 32×32   | Browser tab favicon                   |
| `brand/icon.png`                | 512×512 | High-resolution app/icon metadata     |
| `brand/apple-touch-icon.png`    | 180×180 | iOS home screen icon                  |
| `brand/humanity-union-logo.svg` | vector  | Header/footer logo placeholder source |

## Current locations

- `apps/web/public/brand/favicon.ico`
- `apps/web/public/brand/apple-touch-icon.png`
- `apps/web/public/brand/logo-512.png` (512×512 candidate)
- `apps/web/public/brand/humanity-union-logo.svg`
- `apps/web/src/app/brand/favicon.ico` (App Router convention copy)

Root layout metadata in `apps/web/src/app/layout.tsx` references `/brand/favicon.ico` and `/brand/apple-touch-icon.png`.

Replace placeholder assets before public launch and keep filenames stable so metadata does not require code changes.
