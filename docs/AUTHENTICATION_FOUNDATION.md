# Authentication Foundation (TASK-052)

Humanity Union authentication is infrastructure layered beneath civic modules. Civic workflows continue to receive `RequestIdentity` and do not depend on how authentication is implemented.

## Overview

- MongoDB-backed user accounts (`auth_users`)
- MongoDB-backed refresh sessions (`auth_sessions`)
- bcrypt password hashing
- JWT access and refresh tokens
- Bootstrap dev identity fallback (until full migration)

## Environment variables

| Variable                       | Purpose                                         | Default                                                   |
| ------------------------------ | ----------------------------------------------- | --------------------------------------------------------- |
| `MONGODB_URI`                  | Required for register/login/session persistence | none                                                      |
| `JWT_ACCESS_SECRET`            | Signs access tokens                             | dev-only fallback in non-production                       |
| `JWT_REFRESH_SECRET`           | Signs refresh tokens                            | dev-only fallback in non-production                       |
| `JWT_ACCESS_EXPIRES_IN`        | Access token lifetime (e.g. `15m`)              | `15m`                                                     |
| `JWT_ACCESS_TOKEN_TTL_MINUTES` | Alternative numeric access lifetime (minutes)   | unset; when set, overrides `JWT_ACCESS_EXPIRES_IN`        |
| `JWT_REFRESH_EXPIRES_IN`       | Refresh token lifetime (e.g. `7d`)              | `7d`                                                      |
| `AUTH_BOOTSTRAP_FALLBACK`      | Allow bootstrap identity when no JWT            | `true` in development, `false` when `NODE_ENV=production` |
| `WEB_ORIGIN`                   | CORS origin for web app with credentials        | `http://localhost:3000`                                   |
| `NEXT_PUBLIC_API_BASE_URL`     | Web client API base URL                         | `http://localhost:4000`                                   |

## Token model

### Access token (JWT)

Claims:

- `sub` → auth `userId`
- `memberId` → linked member record
- `role` → `member` or `admin`
- `displayName`
- `email`
- `type` → `access`

Sent via `Authorization: Bearer <token>`.

### Refresh token (JWT + hashed session)

- JWT includes `sessionId` and `sub`
- SHA-256 hash of the refresh JWT is stored in `auth_sessions.refreshTokenHash`
- Refresh token may also be set as an httpOnly cookie (`hu_refresh_token`) on auth routes
- Web dev client currently mirrors tokens in `localStorage` with a TODO to move fully to httpOnly cookies

## API routes

| Method | Path                    | Description                   |
| ------ | ----------------------- | ----------------------------- |
| `POST` | `/api/v1/auth/register` | Create account + issue tokens |
| `POST` | `/api/v1/auth/login`    | Sign in + issue tokens        |
| `POST` | `/api/v1/auth/refresh`  | Refresh access token          |
| `POST` | `/api/v1/auth/logout`   | Revoke refresh session        |
| `GET`  | `/api/v1/auth/me`       | Safe current user projection  |

## RequestIdentity integration

1. `authenticationMiddleware` resolves JWT when present.
2. If no JWT and `AUTH_BOOTSTRAP_FALLBACK=true`, bootstrap identity is applied.
3. `resolveRequestIdentity(req)` maps `req.auth` to civic `RequestIdentity`.
4. When fallback is disabled and no JWT identity exists, `AuthenticationRequiredError` is thrown.

Civic modules are unchanged; they still call `resolveRequestIdentity`.

## Bootstrap fallback

Bootstrap identity (`member-bootstrap-001`) remains available for development and verification scripts when `AUTH_BOOTSTRAP_FALLBACK=true`.

When disabled:

- Protected workspace mutations require a valid JWT
- `/auth/me` without JWT returns `401`

## Security assumptions

- Passwords are bcrypt-hashed; plain passwords are never stored
- Refresh token hashes are stored; raw refresh secrets are not persisted
- Public projections never expose `passwordHash`, session hashes, or provider metadata
- MongoDB must be available for registration/login; errors are explicit (`503`) when unavailable
- Dev JWT secrets must be replaced before production deployment

## Web pages

- `/register` — email, display name, password
- `/login` — email, password
- `/account` — current user + logout

Workspace navigation shows the authenticated display name when `/auth/me` succeeds.

## Verification

```bash
npm run verify:auth
```

Requires `MONGODB_URI`. Runs three consecutive passes and a Capability 02 regression check.

## Deferred work

- Email verification
- Registration email confirmation (six-digit code) — see [REGISTRATION_EMAIL_CONFIRMATION.md](./REGISTRATION_EMAIL_CONFIRMATION.md)
- Password reset
- OAuth / social login
- httpOnly-only token storage in the web client
- Role management beyond bootstrap-compatible `member` / `admin`
- Removing bootstrap fallback after full platform migration
