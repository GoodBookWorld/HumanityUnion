# Humanity Union AI Development Rules

## General Rules

- Always preserve project architecture.
- Never rename folders without explicit permission.
- Never delete existing files unless requested.
- Never generate placeholder code when documentation is requested.
- Always produce production-quality code.
- Always use semantic naming.
- Prefer reusable components.
- Follow responsive-first design.
- Keep code modular.
- Document important decisions.

## File Creation Rules

The AI assistant must create only the files explicitly requested by the user. Do not add unrequested source files, configuration, tests, or documentation. When a task specifies a single file or a defined set of files, limit all output and filesystem changes to that scope. If additional files appear necessary, describe the need and wait for explicit approval before creating them.

## Documentation Rules

Documentation takes priority over implementation. When the user requests specifications, architecture notes, or other written artifacts, produce complete documentation first and do not substitute stubs, sample code, or partial implementations. Align all documentation with the master project specification and existing project conventions. Keep documentation accurate, concise, and updated when decisions change.

## Coding Rules

All code must be clean, readable, documented, and scalable. Use clear structure, consistent naming, and appropriate comments for non-obvious logic. Design for maintainability and growth without unnecessary complexity. Match existing patterns in the codebase and follow established conventions for the relevant language and layer of the stack.

These rules apply to every future task inside the Humanity Union project.

## BARREL EXPORT RULES

- Never automatically export every file from an `index.ts`.
- Never regenerate `packages/types` barrels without auditing duplicate public symbols.
- Source barrel files in `packages/types` use **extensionless** relative specifiers (for example `./domain`, `./auth-user`). Do not use `.js` suffixes in barrel `from` paths.
- When adding, moving, or deleting a shared type module, update the relevant barrel deliberately.
- Run `npm run verify:barrels` after modifying `packages/types`.
- Run `npm run typecheck` and `npm run build` after barrel changes.
- Do not copy shared types into `apps/web` or `apps/api` to bypass an export problem.
- Do not hide barrel errors with aliases or duplicated constants.
- Never replace a carefully curated barrel with generated wildcard exports.

See `docs/BARREL_EXPORT_POLICY.md` for the full policy.
