# Change: Add `reffy summarize` command

## Why
Reffy is being used as an ideation layer before OpenSpec proposal authoring, but artifact context can be spread across multiple markdown files. A lightweight summarization command improves handoff quality and reduces manual synthesis overhead.

## What Changes
- Add a new CLI command: `reffy summarize [--repo PATH] [--output text|json]`.
- Generate a concise structured summary from `.references/artifacts/` files referenced by `.references/manifest.json`.
- Provide a `Suggested Reffy References` section to support OpenSpec proposal citation.
- Keep the command read-only (no mutation of artifacts or manifest).

## Impact
- Affected specs: `artifact-summary`
- Affected code: `src/cli.ts`, new summary helper module(s), and related documentation.

## Reffy References
- `openspec-handoff-summary.md` - defines problem, scope, output shape, and acceptance criteria for summarize command.
