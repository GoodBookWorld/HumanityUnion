# Media object storage — replace / delete / orphan policy

Production Pre-Deployment Hardening Pack 01 + Production Deployment Pack 02.

## Classification

| Purpose | Visibility | Storage |
|---|---|---|
| Avatar | Public CDN/API URL | `MediaObjectStorage` (`avatars/…`) |
| Initiative cover / image | Public | `MediaObjectStorage` (`initiatives/…`) |
| Blog cover / image | Public | `MediaObjectStorage` (`blog/…`) |
| Shared Documents | Private — authz-gated download API | `SecureDocumentStorageProvider` — local secure root **or** dedicated `R2_PRIVATE_BUCKET` (never public CDN) |
| Civic Archive PDF | On-demand in-memory generation | No object storage |

## Metadata durability

`media_upload_records` (Mongo) stores ownership / `mediaId` / `storageKey` inventory.
Hydrated into process cache at Mongo bootstrap. Survives API restart when Mongo is configured.

## Replace

When a cover/avatar is replaced, the domain record points at the new `mediaUrl` / `storageKey`. Best effort: call `MediaUploadService.deleteMedia` for the previous platform media id when known. If the previous object cannot be deleted (provider error), leave the orphan and continue the user-facing replace.

## Remove / soft-delete

Domain soft-delete or draft purge should attempt `deleteFile(storageKey)` for known keys. Shared Documents keep their existing authorized delete path — never expose private bytes via public object URLs.

## Orphan cleanup

No broad destructive sweeper in this Pack. Orphans may remain until a future ops job with inventory from Mongo media metadata. Do not delete by guessing keys.

## Production / staging provider

Prefer `MEDIA_STORAGE_PROVIDER=r2` with:

- `R2_BUCKET` + `R2_PUBLIC_BASE_URL` for public media only
- `R2_PRIVATE_BUCKET` (different bucket, **no** public custom domain) for Shared Documents

Local filesystem is ephemeral on Render unless an operator explicitly accepts `MEDIA_ALLOW_EPHEMERAL_LOCAL_STORAGE=true`.
