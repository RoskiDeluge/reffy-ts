# Change: Add `reffy doctor` diagnostics command

## Why
New users need quick feedback on whether their Reffy setup is healthy, especially when optional SDD tools like OpenSpec are not installed. A diagnostics command reduces setup friction and clarifies required vs optional dependencies.

## What Changes
- Add `reffy doctor [--repo PATH] [--output text|json]`.
- Validate core Reffy setup: `.references/`, manifest validity, and required AGENTS files.
- Report optional ecosystem checks (initially `openspec` availability) as warnings.
- Return non-zero only for core integrity failures; warnings alone should not fail the command.

## Impact
- Affected specs: `doctor-diagnostics`
- Affected code: `src/cli.ts`, diagnostics helper module(s), and README usage docs.

## Reffy References
- `doctor-command-plan.md` - approved diagnostic scope, output, and exit-code behavior.
