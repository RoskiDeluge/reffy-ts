## 1. Implementation
- [x] 1.1 Add `summarize` command routing in `src/cli.ts` with `text|json` output support.
- [x] 1.2 Implement artifact summary generation from manifest-indexed files in `.references/artifacts/`.
- [x] 1.3 Ensure summarize is read-only and handles empty artifact sets gracefully.
- [x] 1.4 Include `Suggested Reffy References` in both text and json outputs.
- [x] 1.5 Update `README.md` command documentation and usage examples.

## 2. Verification
- [x] 2.1 Run `npm run build` and `npm run check`.
- [x] 2.2 Run `node dist/cli.js summarize --output text` and verify readable summary sections.
- [x] 2.3 Run `node dist/cli.js summarize --output json` and verify structured keys.
