# Feature Idea: `reffy summarize`

## Problem
Reffy artifacts can grow quickly during ideation. By the time a change moves into OpenSpec, proposal authors must manually scan multiple notes and extract key points.

## Proposed Feature
Add a new CLI command:

- `reffy summarize [--repo PATH] [--output text|json]`

The command generates a concise summary of current artifacts to speed up handoff into OpenSpec proposal writing.

## Scope (Small)
- Read `.references/manifest.json`
- Load artifact markdown files under `.references/artifacts/`
- Produce a short structured summary:
  - Themes
  - Open questions
  - Candidate changes
  - Suggested `Reffy References` list for OpenSpec `proposal.md`

## Why It Fits Reffy
- Keeps Reffy focused on ideation and context preparation
- Improves the quality and speed of OpenSpec handoff
- Reinforces the citation model already documented in `.references/AGENTS.md`

## UX Sketch
Text mode example:

```text
Themes:
- Manifest ergonomics
- OpenSpec handoff consistency

Open Questions:
- Should summaries include artifact confidence score?

Suggested Reffy References:
- openspec-handoff-summary.md - summarization approach and rationale
- testing.md - existing context notes
```

JSON mode example:

```json
{
  "themes": ["Manifest ergonomics", "OpenSpec handoff consistency"],
  "open_questions": ["Should summaries include artifact confidence score?"],
  "suggested_reffy_references": [
    {
      "filename": "openspec-handoff-summary.md",
      "reason": "summarization approach and rationale"
    }
  ]
}
```

## Acceptance Criteria
- Command exits `0` when manifest is valid and readable
- Output works in both text and json modes
- Empty artifact set is handled gracefully
- No mutation of artifacts or manifest data

## Follow-Up (Optional)
- Add a `--max-artifacts N` flag
- Add a lightweight heuristics pass to detect duplicate ideas across artifacts
