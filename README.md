# reffy-ts

Reffy is intended as an ideation layer for spec-driven development (SDD) in straightforward, version controlled and agent-friendly markdown files.

## Install

Recommended usage in any repo:

```bash
npm install github:RoskiDeluge/reffy-ts
```

The install runs this package's `prepare` step, which builds `dist/` automatically.

## Quickstart (CLI-only)

Inside your project:

```bash
npx reffy init
npx reffy bootstrap
npx reffy doctor
npx reffy reindex
npx reffy validate
npx reffy summarize
```

Command summary:

- `reffy init`: idempotently creates/updates root `AGENTS.md` managed block and `.references/AGENTS.md`.
- `reffy bootstrap`: idempotently runs `init`, ensures `.references/` structure exists, then reindexes artifacts.
- `reffy doctor`: diagnoses required Reffy setup and optional tool availability.
- `reffy reindex`: reconciles `.references/manifest.json` with `.references/artifacts` by adding missing files and removing stale entries.
- `reffy validate`: validates `.references/manifest.json` against manifest v1 contract.
- `reffy summarize`: generates a read-only handoff summary from indexed artifacts.

Output modes:

- `--output text` (default)
- `--output json`
- `--json` (shortcut for `--output json`)

Examples:

```bash
npx reffy reindex --output json
npx reffy validate --repo .
npx reffy doctor --output text
npx reffy doctor --output json
npx reffy summarize --output text
npx reffy summarize --output json
```

## Manifest v1 Contract

File: `.references/manifest.json`

Top-level required fields:

- `version` (must be `1`)
- `created_at` (ISO timestamp)
- `updated_at` (ISO timestamp)
- `artifacts` (array)

Artifact required fields:

- `id` (string)
- `name` (string)
- `filename` (safe relative path under `.references/artifacts/`)
- `kind` (one of: `note`, `json`, `diagram`, `image`, `html`, `pdf`, `doc`, `file`)
- `mime_type` (string)
- `size_bytes` (non-negative number)
- `tags` (string array)
- `created_at` (ISO timestamp)
- `updated_at` (ISO timestamp)

Kind/extension rules:

- `note`: `.md`
- `json`: `.json`
- `diagram`: `.excalidraw`
- `image`: `.png`, `.jpg`, `.jpeg`
- `html`: `.html`, `.htm`
- `pdf`: `.pdf`
- `doc`: `.doc`, `.docx`
- `file`: any extension

## Migration Notes

- Use CLI commands instead of HTTP endpoints.
- If you previously relied on `/references/reindex`, replace it with `reffy reindex`.
- Connector-specific data files are no longer required by the core flow.

## Collaboration Model

Use git PR/merge as the source of truth for `.references/` collaboration.

## Environment Variables

No environment variables are required for core CLI usage.

## Develop

For local development of this repo:

```bash
npm install
npm run build
npm run check
npm test
```

Testing includes a coverage gate with a minimum global threshold of 80%.
