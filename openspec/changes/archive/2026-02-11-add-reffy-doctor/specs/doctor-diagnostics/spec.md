## ADDED Requirements

### Requirement: Doctor Command Availability
The CLI SHALL provide a `doctor` command that reports repository diagnostics for Reffy setup health.

#### Scenario: Text diagnostics output
- **WHEN** a user runs `reffy doctor --output text`
- **THEN** the CLI outputs human-readable diagnostic results
- **AND** the output distinguishes required failures from optional warnings

#### Scenario: JSON diagnostics output
- **WHEN** a user runs `reffy doctor --output json`
- **THEN** the CLI outputs machine-readable diagnostics with required and optional checks
- **AND** the output is suitable for automation

### Requirement: Core Integrity Failure Behavior
The `doctor` command MUST exit non-zero when required Reffy setup checks fail.

#### Scenario: Required check fails
- **WHEN** required files are missing or manifest validation fails
- **THEN** `reffy doctor` returns a non-zero exit code
- **AND** the failure details identify which required checks failed

### Requirement: Optional Tool Warning Behavior
The `doctor` command SHALL treat optional ecosystem tool checks as warnings, not failures.

#### Scenario: Optional tool is unavailable
- **WHEN** an optional tool (such as `openspec`) is not found
- **THEN** `reffy doctor` reports a warning for that check
- **AND** the command still exits successfully if required checks pass
