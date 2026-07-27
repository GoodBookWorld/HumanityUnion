# IP Geolocation Operations

Humanity Union resolves **approximate visitor geography** for the Home page geographic navigator demonstration only.

This is not Member Profile geography, Preferences, Participation Area, or verified residence.

## API

`GET /api/v1/public/ip-geography/approximate`

Response shape (`ApproximateIpGeography`):

```typescript
{
  countryCode?: string;
  countryName?: string;
  regionCode?: string;
  regionName?: string;
  cityName?: string;
  source: "hosting_header" | "provider" | "dev_fixture" | "unavailable";
}
```

Headers on success:

- `Cache-Control: private, no-store`
- `Vary: X-Forwarded-For, CF-IPCountry, X-Vercel-IP-Country`

## Resolver order

Implementation: `apps/api/src/modules/ip-geography/resolve-approximate-ip-geography.ts`

1. `IP_GEOLOCATION_DEV_FIXTURE` when set (development/staging fixtures only)
2. Trusted hosting/CDN headers:
   - `CF-IPCountry`, `CF-Region-Code`, `CF-IPCity`
   - `X-Vercel-IP-Country`, `X-Vercel-IP-Country-Region`, `X-Vercel-IP-City`
   - `CloudFront-Viewer-Country`, `CloudFront-Viewer-Country-Region`, `CloudFront-Viewer-City`
3. Fallback `{ source: "unavailable" }` (UI shows **World** only)

## Request IP handling

- Uses the first `X-Forwarded-For` hop when present
- Local/private addresses do not receive fabricated city data
- Raw IP values must not appear in API responses, UI, MongoDB, or long-lived logs

## Development fixtures

Examples:

```bash
IP_GEOLOCATION_DEV_FIXTURE=CA
IP_GEOLOCATION_DEV_FIXTURE=CA::CA-BC::Nelson
IP_GEOLOCATION_DEV_FIXTURE=world
```

Without a fixture, localhost typically resolves to World only.

## Cache isolation

The Home page shell may be statically rendered, but approximate geography is fetched client-side per visitor with `cache: no-store`. Do not embed visitor-specific geography in shared static caches or CDN edge HTML.

## Staging / production deployment

Ensure the hosting layer forwards trusted geolocation headers to the API process:

- Cloudflare: `CF-IPCountry`, optional `CF-Region-Code`, `CF-IPCity`
- Vercel: `X-Vercel-IP-*` headers
- CloudFront: `CloudFront-Viewer-*` headers

Configure reverse proxies to pass `X-Forwarded-For` from the client connection without overwriting trusted geo headers injected at the edge.

Do not commit provider API keys in the repository. External paid providers may be added behind the same abstraction without exposing credentials to the browser.

## Privacy

- No raw IP persistence in Member Profile, Preferences, Participation Area, or analytics documents
- Approximate geography is demonstration-only and non-editable on Home
- City names from IP are displayed as text; they are not mapped to community organizations automatically
