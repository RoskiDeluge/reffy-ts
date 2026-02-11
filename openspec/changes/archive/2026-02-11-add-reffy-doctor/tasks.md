## 1. Implementation
- [x] 1.1 Add `doctor` command routing in `src/cli.ts` with `text|json` output support.
- [x] 1.2 Implement core setup checks for required Reffy files and manifest validity.
- [x] 1.3 Implement optional tool checks (initially `openspec` on PATH) as warnings.
- [x] 1.4 Implement exit code behavior: fail only for required check failures.
- [x] 1.5 Update `README.md` with `doctor` command documentation and examples.

## 2. Verification
- [x] 2.1 Run `npm run build` and `npm run check`.
- [x] 2.2 Run `node dist/cli.js doctor --output text` and verify pass/warn/fail sections.
- [x] 2.3 Run `node dist/cli.js doctor --output json` and verify structured payload + exit behavior.
- [x] 2.4 Add/extend tests for required-failure and optional-warning scenarios.
