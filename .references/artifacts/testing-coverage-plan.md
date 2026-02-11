# Feature Idea: Add Automated Tests With >=80% Coverage Gate

## Problem
`reffy-ts` currently relies on build and type-check validation, but does not enforce automated behavioral tests or coverage thresholds. This increases regression risk as CLI behavior expands.

## Proposed Feature
Introduce a testing foundation for the repo with an enforced minimum coverage threshold of 80%.

## Scope (Phase 1)
- Add a test runner and coverage toolchain suitable for TypeScript + Node ESM.
- Add initial test suites for:
  - CLI command behaviors (smoke/integration level)
  - Manifest validation logic
  - Summarization logic
- Add CI/local scripts to run tests with coverage and fail below threshold.

## Coverage Target
- Enforce **>= 80%** coverage minimum.
- Prefer enforcing by at least lines and statements in Phase 1.
- Expand to branches/functions thresholds as test depth improves.

## Candidate Tooling
- `vitest` (test runner)
- V8 coverage via Vitest built-in coverage provider

## Acceptance Criteria
- `npm test` (or equivalent) runs test suite successfully.
- Coverage report is generated in CLI and/or file output.
- Process exits non-zero if configured threshold (<80%) is not met.
- Tests run reliably on local dev and CI.

## Implementation Considerations
- Keep tests deterministic and filesystem-safe using temp directories.
- Avoid network dependencies in test paths.
- Keep fixtures small and representative of `.references` flows.

## Open Questions
- Should 80% apply to global totals only, or per-file minimums?
- Should thresholds include branches/functions immediately or in a follow-up?
- Do we enforce coverage on `src/cli.ts` output formatting paths in Phase 1?

## Suggested Reffy References
- `openspec-handoff-summary.md` - example of Reffy->OpenSpec handoff pattern.
- `testing.md` - baseline reference artifact already in repo.
