# API Module Resolution

This document records the TypeScript module strategy for `apps/api` after TASK-INFRA-001 / TASK-INFRA-001B, including how it interacts with `@hu/types` barrel policy and production runtime.

## Selected Strategy (Option A)

**Keep `module: ESNext` + `moduleResolution: bundler` in `apps/api/tsconfig.json`.**

| Setting            | Value     | Purpose                                                                                           |
| ------------------ | --------- | ------------------------------------------------------------------------------------------------- |
| `module`           | `ESNext`  | ESM emit compatible with `"type": "module"`                                                       |
| `moduleResolution` | `bundler` | Resolve extensionless `@hu/types` source barrels (required for Turbopack-aligned monorepo policy) |
| `outDir`           | `dist`    | Compiled JavaScript for `pnpm start`                                                              |

### Why API Was Changed from NodeNext / NodeNext

During TASK-INFRA-001, `@hu/types` barrels were standardized to **extensionless** relative specifiers (for example `export * from "./domain"`) so Next.js 16 / Turbopack can import TypeScript source without looking for literal `.js` files on disk.

With `moduleResolution: NodeNext`, TypeScript checking `apps/api` treated re-exports from `@hu/types` as **empty** (mass TS2305: “has no exported member …”) because NodeNext could not resolve extensionless paths inside the types package source.

`module: ESNext` + `moduleResolution: bundler` restores correct type re-export resolution while preserving ESM output.

TypeScript 6 rejects `module: NodeNext` paired with `moduleResolution: bundler`, so both settings were updated together.

## Development Runtime

```bash
pnpm --filter @hu/api dev    # tsx watch src/index.ts
```

- Loads TypeScript source directly via `tsx`
- Resolves `@hu/types` through package exports → `packages/types/src/index.ts`
- No separate types build step

## Production Compiled Runtime

### Build

```bash
pnpm --filter @hu/api build   # tsc -p apps/api/tsconfig.json
```

`tsc` emits JavaScript under `apps/api/dist/` with **`.js` extensions on relative imports** (for example `from "./app.js"`), which Node.js ESM resolves correctly.

`@hu/types` imports are **type-only** in most API modules and are erased from emitted JavaScript — there is no runtime `@hu/types` path resolution in `dist/`.

### Start commands

| Command           | Entry                | Used by                                                   |
| ----------------- | -------------------- | --------------------------------------------------------- |
| `pnpm start`      | `node dist/index.js` | Local compiled smoke tests                                |
| `pnpm start:prod` | `tsx src/index.ts`   | **Docker production image** (`apps/api/Dockerfile` `CMD`) |

### Compiled smoke test (TASK-INFRA-001B)

```bash
cd apps/api
pnpm build
PORT=4013 pnpm start:prod          # deployment path — PASS (health 200, Mongo connected)
PORT=4011 node dist/index.js       # node dist path — fails at @hu/geography (see below)
curl http://localhost:4013/api/v1/health
```

**Deployment path (`start:prod`)** starts successfully, connects to MongoDB, and serves `GET /api/v1/health` with HTTP 200.

**`node dist/index.js`** currently fails during module load with:

```
ERR_MODULE_NOT_FOUND: .../apps/web/src/data/geography/geography.helpers.js
```

This comes from `@hu/geography` exporting TypeScript source that references a `.js` path under `apps/web`. It is **pre-existing cross-package source-import debt**, not caused by the `@hu/types` barrel policy or ESNext/bundler change. Resolving it requires a dedicated `@hu/geography` build/export strategy (out of scope for barrel infra tasks).

## Shared Types Consumption

```
@hu/types (package.json exports → ./src/index.ts)
  └── packages/types/src/index.ts
        export * from "./common";
        export * from "./domain";
```

- **Barrels:** extensionless specifiers only (enforced by `npm run verify:barrels`)
- **Non-barrel modules inside `@hu/types`:** may still use `.js` suffixes where needed for internal Node-oriented modules
- **API compile-time:** bundler resolution follows barrels correctly
- **API runtime:** types erased; no barrel paths at runtime

## Barrel Policy Interaction

See `docs/BARREL_EXPORT_POLICY.md`. Summary:

- Do **not** reintroduce `./domain/index.js` in TypeScript source barrels
- Do **not** weaken `verify:barrels` to allow `.js` barrel suffixes
- If runtime output ever needs explicit extensions, solve via **emit/build/package exports**, not by reverting source barrels to unresolved `.js` paths

## Required Deployment Verification

After changing `apps/api/tsconfig.json`, `@hu/types` barrels, or API build scripts:

```bash
npm run verify:barrels
npm run typecheck
pnpm --filter @hu/api build
PORT=<free-port> pnpm --filter @hu/api start:prod
curl http://localhost:<free-port>/api/v1/health
```

Expect HTTP 200 and `"mongodb":{"connected":true}` in the health payload.

## Related Files

- `apps/api/tsconfig.json`
- `packages/types/tsconfig.json`
- `apps/api/Dockerfile` — production CMD uses `start:prod`
- `docs/BARREL_EXPORT_POLICY.md`
- `scripts/verify-barrel-integrity.ts`
