## ADDED Requirements

### Requirement: Automated Test Execution
The project SHALL provide an automated test command for repository code paths.

#### Scenario: Test command succeeds
- **WHEN** a contributor runs the project test command
- **THEN** automated tests execute for supported modules and command flows
- **AND** the process exits with code 0 when all tests pass

### Requirement: Coverage Threshold Enforcement
The project SHALL enforce a minimum global coverage threshold of 80% during test execution.

#### Scenario: Coverage meets threshold
- **WHEN** test execution completes and global coverage is at least 80%
- **THEN** the coverage gate passes
- **AND** the process exits successfully

#### Scenario: Coverage below threshold
- **WHEN** test execution completes and global coverage is below 80%
- **THEN** the coverage gate fails
- **AND** the process exits non-zero

### Requirement: Core Behavior Coverage Scope
The test suite MUST cover core behavior for manifest validation, summarization, and CLI command output modes.

#### Scenario: Core modules are exercised
- **WHEN** tests are executed
- **THEN** manifest validation paths include valid and invalid cases
- **AND** summarization paths include populated and empty artifact contexts
- **AND** CLI output behavior is tested for text and json modes
