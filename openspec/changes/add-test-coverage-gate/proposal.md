# Change: Add automated testing with 80% coverage gate

## Why
`reffy-ts` currently validates build and types but lacks an enforced automated testing baseline. Adding a coverage-gated test workflow will reduce regression risk as CLI functionality grows.

## What Changes
- Introduce a test runner and coverage tooling compatible with Node ESM TypeScript.
- Add initial test suites for manifest validation, summarization behavior, and key CLI command flows.
- Add a coverage threshold gate (minimum 80%) in local and CI test execution.
- Add npm scripts and documentation for running tests and coverage.

## Impact
- Affected specs: `test-coverage`
- Affected code: `package.json`, test files, coverage config, and related docs/workflows.

## Reffy References
- `testing-coverage-plan.md` - approved ideation for test foundation and 80% threshold.
