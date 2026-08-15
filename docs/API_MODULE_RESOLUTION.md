# API Module Resolution

This document records the TypeScript module strategy for `apps/api` after TASK-INFRA-001 / TASK-INFRA-001B, including how it interacts with `@hu/types` barrel policy and production runtime.

## Selected Strategy (Option A)

**Keep `module: ESNext` + `moduleResolution: bundler` in `apps/api/tsconfig.json`.**

| Setting            | Value     | Purpose                                                                                           |
| ------------------ | --------- | ------------------------------------------------------------------------------------------------- |
| `module`           | `ESNext`  | ESM emit compatible with `"type": "module"`                                                       |
| `moduleResolution` | `bundler` | Resolve shared package exports / TS source for API typecheck |
| `outDir`           | `dist`    | Compiled JavaScript for `pnpm start`                                                              |

### Why API Uses bundler resolution

`@hu/types` now uses explicit `.js` relative specifiers and emits compiled ESM under `packages/types/dist/`. Package exports expose:

- `types` → `./src/index.ts` (TypeScript / editor)
- `import` → `./dist/index.js` (Node runtime)

`apps/api` keeps `module: ESNext` + `moduleResolution: bundler` so typechecking remains aligned with the monorepo web toolchain while production Node loads the built types package (no directory imports).

## Development Runtime

```bash
pnpm --filter @hu/types build
pnpm --filter @hu/api dev    # tsx watch src/index.ts
```

- Runtime value imports from `@hu/types` resolve to `packages/types/dist`
- Rebuild `@hu/types` after changing shared type/runtime helpers

## Production Compiled Runtime

### Build

```bash
pnpm build   # builds @hu/types, then API, then Web
```

`tsc` emits JavaScript under `apps/api/dist/` with **`.js` extensions on relative imports**. Runtime `@hu/types` value imports resolve to `packages/types/dist` (not TypeScript source barrels).

### Start commands

| Command           | Entry                | Used by                                                   |
| ----------------- | -------------------- | --------------------------------------------------------- |
| `pnpm start`      | `node dist/index.js` | Local compiled smoke tests / Render-style start           |
| `pnpm start:prod` | `node dist/index.js` | Production compiled entry                                 |

### Compiled smoke test

```bash
pnpm --filter @hu/types build
pnpm --filter @hu/api build
cd apps/api
PORT=4011 node dist/index.js
```

Expect module graph load without `ERR_UNSUPPORTED_DIR_IMPORT` / `ERR_MODULE_NOT_FOUND` from `@hu/types`.

## Shared Types Consumption

```
@hu/types (exports.types → ./src/index.ts, exports.import → ./dist/index.js)
  └── packages/types/src/index.ts
        export * from "./common/index.js";
        export * from "./domain/index.js";
```

- **Barrels + modules:** explicit `.js` relative specifiers (enforced by `npm run verify:barrels`)
- **No directory imports** (`./common`, `./domain`, …)
- **API runtime:** value exports load from `packages/types/dist`

## Barrel Policy Interaction

See `docs/BARREL_EXPORT_POLICY.md`. Summary:

- Prefer `./domain/index.js` / `./auth-user.js` in `@hu/types` source
- Do **not** reintroduce extensionless or directory barrel imports
- Keep `pnpm --filter @hu/types build` in the production build path so `dist/` exists for Node
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
