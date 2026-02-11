# Project Context

## Purpose
`reffy-ts` is a CLI-first references workflow for Node projects.
The project provides a `reffy` command that initializes managed assistant instructions in `AGENTS.md`, manages a `.references/` workspace, reindexes artifacts into a manifest, and validates that manifest against a v1 contract.
Primary goals are idempotent setup, predictable local file-based behavior, and straightforward integration into existing Node repos.

## Tech Stack
- TypeScript (strict mode) targeting Node.js `>=20`
- Node.js built-in modules (`fs`, `path`, `crypto`)
- ESM (`"type": "module"`, `module`/`moduleResolution` set to `NodeNext`)
- CLI runtime and packaging via npm (`bin` entry `reffy -> dist/cli.js`)
- Dependencies:
  - `mime-types` for content type inference
  - `uuid` (available; `randomUUID` is currently sourced from Node `crypto`)
- Dev tooling:
  - `typescript`
  - `tsx` for local watch/dev

## Project Conventions

### Code Style
- TypeScript-first with `strict: true`
- ESM import style with explicit `.js` extensions for local imports in source
- Double-quoted strings and semicolon-terminated statements
- Naming:
  - `camelCase` for functions/variables
  - `PascalCase` for classes/types
  - `snake_case` for persisted manifest fields (for JSON contract compatibility)
- Keep logic explicit and readable over clever abstractions; prefer small helper functions for validation and parsing

### Architecture Patterns
- CLI entrypoint in `src/cli.ts` dispatches subcommands (`init`, `bootstrap`, `reindex`, `validate`)
- Core domain logic lives in `ReferencesStore` (`src/storage.ts`) for file-system and manifest operations
- Manifest schema/constants/validation helpers are centralized in `src/manifest.ts`
- Shared type contracts are defined in `src/types.ts`
- File-system persistence model:
  - `.references/artifacts/` stores artifact files
  - `.references/manifest.json` stores metadata/index
- Commands should be idempotent where possible (`init`, `bootstrap`, `reindex`)

### Testing Strategy
- No formal test suite is currently present in this repository.
- Current quality gate is compile/type validation:
  - `npm run build` (TypeScript compile)
  - `npm run check` (`tsc --noEmit`)
- For behavior changes, validate via CLI smoke checks (`reffy init/bootstrap/reindex/validate`) against a sample repo layout.
- If adding non-trivial logic (especially manifest validation/inference), prefer adding targeted automated tests as follow-up.

### Git Workflow
- Collaboration is PR/merge based.
- Keep changes focused and small, especially for schema/manifest behavior.
- Preserve backward compatibility for `.references/manifest.json` v1 unless explicitly introducing a versioned breaking change.
- Update `README.md` when CLI behavior, commands, or contract details change.

## Domain Context
- This project is a local references layer for AI-assisted development workflows.
- `AGENTS.md` contains a managed Reffy block (`<!-- REFFY:START --> ... <!-- REFFY:END -->`) that must be inserted/updated idempotently.
- Manifest contract expectations:
  - Top-level fields: `version`, `created_at`, `updated_at`, `artifacts`
  - Each artifact requires metadata (`id`, `name`, `filename`, `kind`, `mime_type`, `size_bytes`, `tags`, timestamps)
- Artifact `kind` controls allowed filename extensions for validation (`note`, `json`, `diagram`, `image`, `html`, `pdf`, `doc`, `file`).

## Important Constraints
- Node.js version must be `>=20`.
- TypeScript output targets `dist/` with declarations enabled.
- Manifest compatibility:
  - Current supported contract version is `1`.
  - Validation enforces shape, safe relative paths, duplicate checks, and kind/extension rules.
- Core workflow should not require environment variables or external services.
- Commands are expected to run safely in existing repos without destructive side effects outside `.references/` and managed `AGENTS.md` block updates.

## External Dependencies
- No required external APIs/services for core functionality.
- Runtime package dependencies:
  - `mime-types`
  - `uuid`
- Integration surface is local filesystem + git-based collaboration in consumer repositories.
