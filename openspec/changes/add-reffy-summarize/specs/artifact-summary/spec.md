## ADDED Requirements

### Requirement: Artifact Summary Command
The CLI SHALL provide a `summarize` command that reads Reffy artifacts and returns a concise summary suitable for proposal handoff.

#### Scenario: Text summary output
- **WHEN** a user runs `reffy summarize --output text`
- **THEN** the CLI returns a text summary including themes, open questions, candidate changes, and suggested Reffy references
- **AND** the command exits successfully when manifest data is readable and valid

#### Scenario: JSON summary output
- **WHEN** a user runs `reffy summarize --output json` (or equivalent json mode)
- **THEN** the CLI returns machine-readable JSON containing summary sections and suggested Reffy references
- **AND** the output format is stable enough for downstream automation

### Requirement: Read-Only Summarization Behavior
The `summarize` command MUST NOT mutate `.references/manifest.json` or files in `.references/artifacts/`.

#### Scenario: Summarization does not modify repository context files
- **WHEN** a user runs `reffy summarize`
- **THEN** no artifact file contents are changed
- **AND** no manifest metadata is modified as part of summarize execution

### Requirement: Empty Artifact Handling
The system SHALL handle an empty artifact set without errors.

#### Scenario: No artifacts available
- **WHEN** `.references/artifacts/` has no indexed content to summarize
- **THEN** `reffy summarize` returns a valid empty/neutral summary response
- **AND** the command exits successfully
