# Barrel Export Policy

This document defines how shared TypeScript types are exported from `@hu/types` and how to keep barrel files healthy.

## What Is a Barrel File?

A **barrel file** is an `index.ts` that re-exports symbols from other modules so consumers can import from a single entry point (for example `@hu/types`).

In this monorepo, barrels live under:

```
packages/types/src/index.ts
packages/types/src/common/index.ts
packages/types/src/domain/index.ts
packages/types/src/domain/*/index.ts   (nested domain barrels)
```

## How `@hu/types` Is Consumed

The package exports **TypeScript source**, not compiled JavaScript:

```json
"exports": {
  ".": "./src/index.ts"
}
```

Consumers import directly from source:

- `apps/api` (NodeNext / `tsc`)
- `apps/web` (Next.js 16, `transpilePackages: ["@hu/types"]`, Turbopack and Webpack)

There is no separate build step for `@hu/types`. Barrels must resolve when Next.js/Turbopack and TypeScript follow source paths.

## Protected Barrels

These files are checked by `npm run verify:barrels`:

| File                                                           | Role                                  |
| -------------------------------------------------------------- | ------------------------------------- |
| `packages/types/src/index.ts`                                  | Root public API (`common` + `domain`) |
| `packages/types/src/common/index.ts`                           | Shared primitives                     |
| `packages/types/src/domain/index.ts`                           | Domain type surface                   |
| `packages/types/src/domain/collective-decision/index.ts`       | Collective decision sub-domain        |
| `packages/types/src/domain/implementation/index.ts`            | Implementation sub-domain             |
| `packages/types/src/domain/implementation-commitment/index.ts` | Implementation commitment sub-domain  |
| `packages/types/src/domain/petition/index.ts`                  | Petition sub-domain                   |

Any new `index.ts` under `packages/types/src` is automatically included in verification.

## Canonical Module Specifier Style (Barrels Only)

**In barrel files**, use extensionless relative specifiers:

```typescript
// packages/types/src/index.ts
export * from "./common";
export * from "./domain";

// packages/types/src/domain/index.ts
export type { AuthUserPublic } from "./auth-user";
export { MEMBERSHIP_VOTE_WEIGHT_TRANSPARENCY_NOTE } from "./membership-statistics";
export type { CollectiveDecision } from "./collective-decision";
```

### Allowed

- `./domain`
- `./auth-user`
- `./collective-decision` (resolves to `./collective-decision/index.ts`)

### Disallowed in barrels

- `./common/index.js`
- `./domain/index.js`
- `./auth-user.js`
- `./capability02-integration.js`

### Why `.js` specifiers failed

When Next.js/Turbopack imports `@hu/types` source, it resolves paths literally. A barrel that says:

```typescript
export * from "./domain/index.js";
```

makes the bundler look for a **`.js` file on disk**. Under `packages/types/src` only `.ts` files exist, so resolution fails with errors such as:

```
Module not found: ./domain/index.js
Module not found: ./capability02-integration.js
```

Non-barrel modules may still use `.js` extensions in their internal imports where required by NodeNext emit rules. **This policy applies to barrel `index.ts` files only.**

## TypeScript Module Resolution (Audited)

| Project                        | Settings                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `packages/types/tsconfig.json` | `moduleResolution: bundler` — matches source barrel policy                                                    |
| `apps/api/tsconfig.json`       | `module: ESNext`, `moduleResolution: bundler` — resolves extensionless `@hu/types` barrels while emitting ESM |
| `apps/web/tsconfig.json`       | `moduleResolution: bundler`, `transpilePackages: ["@hu/types"]`                                               |

`moduleResolution: NodeNext` with `module: NodeNext` caused `@hu/types` re-exports to appear empty (TS2305) because extensionless barrel paths did not resolve. API now uses `module: ESNext` with `moduleResolution: bundler` to align with Next.js source imports.

## Adding a New Shared Type

Example: add `packages/types/src/domain/example.ts`.

1. Create the module and export only the intended public names.
2. Add an **explicit** export line to `packages/types/src/domain/index.ts`:

   ```typescript
   export type { ExamplePayload } from "./example";
   ```

3. Run verification:

   ```bash
   npm run verify:barrels
   npm run typecheck
   npm run build
   ```

4. Do **not** add `export * from "./example"` unless you intentionally want every symbol public.

## Removing or Moving a Shared Type

1. Update or remove the barrel export line first.
2. Move or delete the source module.
3. Fix imports in `apps/api` and `apps/web` if paths changed.
4. Run `npm run verify:barrels`, `npm run typecheck`, and `npm run build`.

## Duplicate Exports

Duplicate public symbols occur when the same name is exported twice through the root barrel, for example:

- `ParticipantId` from both `implementation/index.ts` and `implementation-commitment/index.ts`
- `CollectiveDecisionId` from multiple sub-barrels re-exported at the domain root

TypeScript reports this as **TS2308**:

```
Module has already exported a member named 'ParticipantId'. Consider explicitly re-exporting to resolve the ambiguity.
```

`verify:barrels` runs a TypeScript check on `packages/types/src/index.ts` and fails on TS2308.

**Fix:** export only one canonical symbol, or use explicit named re-exports with aliases — never silently delete valid types or auto-generate barrels.

## Blanket Barrel Generation Is Prohibited

Do **not** run scripts that add `export * from` for every `.ts` file in a folder. That pattern caused duplicate symbols and ambiguous public APIs.

Barrel updates must be deliberate and reviewed. A safe generator may be designed later; it is out of scope for the current policy.

## Required Verification Commands

| Command                            | Purpose                                                               |
| ---------------------------------- | --------------------------------------------------------------------- |
| `npm run verify:barrels`           | Fast gate: targets resolve, no `.js` in barrels, no cycles, no TS2308 |
| `npm run verify:barrels:self-test` | Fixture tests for the integrity script                                |
| `npm run typecheck`                | Runs `verify:barrels` first, then project typecheck                   |
| `npm run build`                    | API + Web production build                                            |

Recommended order after barrel edits:

```bash
npm run verify:barrels
npm run typecheck
npm run build
npm run lint
npm run format:check
```

## Troubleshooting

### `Module not found: ./domain/index.js`

The root or nested barrel uses a `.js` suffix or `/index.js` path. Change to extensionless form:

```typescript
export * from "./domain";
```

### `verify:barrels` — missing module

```
BARREL_INTEGRITY_ERROR
File: packages/types/src/domain/index.ts
Line: 120
Specifier: ./removed-module
Reason: Export target does not resolve to an existing .ts module or directory index.ts.
```

Remove the stale export or restore the module file.

### `verify:barrels` — duplicate export

```
Reason: Duplicate public export detected (TS2308).
Specifier: Module './domain' has already exported a member named 'ParticipantId'.
```

Inspect which sub-barrels export the same name and keep a single public export path.

### Prettier vs barrels

Running Prettier on barrel files is safe when specifiers are already extensionless. If a barrel drifts, run:

```bash
npm run format
npm run verify:barrels
```

## Related Documentation

- `.cursor/rules.md` — Cursor agent barrel rules
- `docs/ENGINEERING_VERIFICATION_BASELINE.md` — verification execution order
- `docs/API_MODULE_RESOLUTION.md` — API `ESNext`/`bundler` strategy and production runtime
