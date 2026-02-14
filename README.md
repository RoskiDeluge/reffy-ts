# reffy

[![npm version](https://img.shields.io/npm/v/reffy-cli.svg)](https://www.npmjs.com/package/reffy-cli)
[![MIT License](https://img.shields.io/github/license/RoskiDeluge/reffy-ts.svg)](LICENSE)
[![CI](https://github.com/RoskiDeluge/reffy-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/RoskiDeluge/reffy-ts/actions/workflows/ci.yml)

Reffy is intended as an ideation layer for spec-driven development (SDD) in straightforward, version controlled and agent-friendly markdown files.

## Install

```bash
npm install -g reffy-cli
```

## Quickstart (CLI-only)

Inside your project:

```bash
reffy init
reffy bootstrap
reffy doctor
reffy reindex
reffy validate
reffy summarize
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
reffy reindex --output json
reffy validate --repo .
reffy doctor --output text
reffy doctor --output json
reffy summarize --output text
reffy summarize --output json
```

## Using Reffy With SDD Frameworks (OpenSpec Example)

`reffy` is designed to complement spec-driven development workflows rather than replace them. A common pattern is:

1. Use Reffy for ideation and context capture in `.references/`.
2. Use an SDD framework (for example [OpenSpec](https://github.com/Fission-AI/OpenSpec)) for formal proposals/specs/tasks.
3. Keep a clear handoff from exploratory artifacts to formal specs.

Reference implementation in this repo:

- `AGENTS.md`: contains both managed instruction blocks and encodes sequencing.
- `AGENTS.md`: Reffy block routes ideation/exploration requests to `@/.references/AGENTS.md`.
- `AGENTS.md`: OpenSpec block routes planning/proposal/spec requests to `@/openspec/AGENTS.md`.
- `.references/AGENTS.md`: defines Reffy as the ideation/context layer and documents handoff expectations to OpenSpec.
- `openspec/AGENTS.md`: defines OpenSpec as the formal planning/specification workflow after ideation is stable.
- `src/cli.ts`: `reffy init`/`reffy bootstrap` enforce this integration by idempotently writing the managed Reffy guidance into `AGENTS.md` and `.references/AGENTS.md`.

Practical connection pattern for any repo:

1. Run `reffy init` to install/refresh the Reffy instruction layer.
2. Keep your SDD framework instructions (for example OpenSpec) in the same root `AGENTS.md`.
3. During planning, cite only relevant Reffy artifacts from `.references/artifacts/` in your proposal/spec docs.
4. Continue implementation in your SDD framework's normal review/approval process.

## Develop

For local development of this repo:

```bash
npm install
npm run build
npm run check
npm test
```

`npm install` runs this package's `prepare` step, which builds `dist/` automatically.
