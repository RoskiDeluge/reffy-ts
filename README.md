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

## Using Reffy With SDD Frameworks (OpenSpec Example)

`reffy-ts` is designed to complement spec-driven development workflows rather than replace them. A common pattern is:

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

1. Run `npx reffy init` to install/refresh the Reffy instruction layer.
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

