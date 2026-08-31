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

## Chat Agent Continuity

AI recovery entry: `architecture/recovery/chat-agent/README.md`
Canonical live handoff: `project/NEXT_SESSION.md`

### Documentation Gate (before any Pack may report COMPLETE)

A Pack/Epic is **not CLOSED** until this gate is evaluated:

1. Update `project/NEXT_SESSION.md` whenever the live objective changed.
2. Update current-focus / last-completed in `project/PROJECT_STATE.md`.
3. Update `project/PROJECT_DASHBOARD.md` when capability/Pack status actually changed.
4. Add a `project/WORK_LOG.md` entry when useful for historical traceability.
5. Update ADR / change register when architectural decisions changed.
6. Update `architecture/recovery/chat-agent/README.md` only when recovery paths, authority structure, environment topology, or major current focus changed.
7. Do **not** paste full Pack reports into `architecture/recovery/chat-agent/`.
8. The completion report MUST list which canonical documents were updated or why no update was required.

Do not require meaningless edits when a document is unaffected. See also `architecture/DEVELOPMENT_BASELINE.md` § Documentation Gate.

Every Bash/operator instruction must explicitly label the execution location: **CURSOR AGENT**, **LOCAL MAC TERMINAL**, **RENDER API WEB SHELL**, or **RENDER WEB WEB SHELL**.

A stale live-state document must not override a normative ADR. Superseded ADR-002 (Activity-root) must not override `ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0`. Repository evidence wins over stale narrative documentation. Never commit secrets or `production-admin-source.json`.
