# Media Upload Foundation

Humanity Union stores participant-uploaded images through a small authenticated media-upload module. Binary data is never stored in MongoDB domain documents; only stable media URLs are persisted on Member Profile and Initiative records.

## Architecture

```
Browser (multipart/form-data)
  → POST /api/v1/media/avatar | /initiative-image
  → media-upload.validation.ts (MIME, size, extension checks)
  → media-upload.service.ts
  → local-media.provider.ts (development default)
  → /api/v1/media/files/* static route
  → returned mediaUrl stored in profile.avatarUrl or initiative.metadata.imageUrl
```

The storage boundary is defined by `MediaStorageProvider` in `apps/api/src/modules/media-upload/media-upload.provider.ts` (via `local-media.provider.ts`). Production can swap in S3-compatible, Cloudflare R2, or Backblaze B2 providers without changing initiative or member-profile modules.

## Local development storage

Uploaded files are written to:

- `apps/api/.runtime/uploads/avatars/`
- `apps/api/.runtime/uploads/initiatives/`

This directory is gitignored. Files are exposed read-only at:

- `GET /api/v1/media/files/avatars/{generated-filename}`
- `GET /api/v1/media/files/initiatives/{generated-filename}`

Static file responses set `Cross-Origin-Resource-Policy: cross-origin`, `Access-Control-Allow-Origin` to the configured `CORS_ORIGIN`, `X-Content-Type-Options: nosniff`, and an explicit image `Content-Type`. This allows the web app (e.g. `http://localhost:3000`) to render uploaded avatars and initiative images served from the API origin without browser CORB blocking.

Participant uploads must not be placed in `apps/web/public/`.

## Validation

Allowed participant image formats:

- `image/jpeg`
- `image/png`
- `image/webp`

Size limits:

- Avatar: 2 MB
- Initiative image: 5 MB

Rejected uploads include unsupported MIME types, extension/MIME conflicts, executable/HTML content masquerading as images, oversized files, and path traversal attempts. Server-side filenames are generated; original filenames are never used as storage paths.

## Authorization

- Avatar upload belongs to the authenticated participant (`req.auth`).
- Initiative image upload requires initiative steward ownership (`initiativeId` in form body, validated server-side).
- Deletion requires media owner authorization.
- Replacing an image retires the previous stored file when deleted through the media API.

## Profile and initiative integration

- Member profile UI uploads through `/api/v1/media/avatar` and persists the returned URL in `avatarUrl`.
- Initiative create/edit forms upload through `/api/v1/media/initiative-image` and persist `metadata.imageUrl`.
- Avatar URL validation accepts platform media URLs in addition to standard HTTPS image URLs.

## Production object storage (deferred)

Paid object-storage integration, CDN delivery, image moderation, and server-side resizing/cropping are intentionally deferred. The provider adapter boundary is prepared for a future migration.

## Navigation updates (TASK-077)

Public world initiatives:

- `/initiatives` — public World Initiatives listing

Private initiative workspace:

- `/workspace/initiatives` — authenticated My Initiatives management
