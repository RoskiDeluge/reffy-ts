import path from "node:path";

import { describe, expect, it } from "vitest";

import { summarizeArtifacts } from "../src/summarize.js";
import type { Artifact } from "../src/types.js";
import { addArtifact, createTempRepo } from "./helpers.js";

describe("summarizeArtifacts", () => {
  it("summarizes themes, questions, candidate changes, and references", async () => {
    const repo = await createTempRepo();
    await addArtifact(repo, {
      filename: "feature.md",
      content: [
        "# Feature Idea: Add Test Coverage",
        "",
        "## Proposed Feature",
        "- `reffy summarize --output json`",
        "",
        "## Open Questions",
        "- Should we enforce 80% globally?",
      ].join("\n"),
    });

    const store = {
      async listArtifacts(): Promise<Artifact[]> {
        return [
          {
            id: "a",
            name: "feature",
            filename: "feature.md",
            kind: "note",
            mime_type: "text/markdown",
            size_bytes: 10,
            tags: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ];
      },
      getArtifactPath(artifact: Artifact): string {
        return path.join(repo.artifactsDir, artifact.filename);
      },
    };

    const result = await summarizeArtifacts(store);
    expect(result.themes).toContain("Add Test Coverage");
    expect(result.open_questions).toContain("Should we enforce 80% globally?");
    expect(result.candidate_changes[0]).toContain("Introduce reffy summarize --output json");
    expect(result.suggested_reffy_references[0]).toEqual({
      filename: "feature.md",
      reason: "feature ideation and rationale",
    });
  });

  it("handles empty artifact lists", async () => {
    const store = {
      async listArtifacts(): Promise<Artifact[]> {
        return [];
      },
      getArtifactPath(): string {
        return "";
      },
    };

    const result = await summarizeArtifacts(store);
    expect(result).toEqual({
      themes: [],
      open_questions: [],
      candidate_changes: [],
      suggested_reffy_references: [],
    });
  });

  it("skips unreadable artifact files", async () => {
    const store = {
      async listArtifacts(): Promise<Artifact[]> {
        return [
          {
            id: "a",
            name: "missing",
            filename: "missing.md",
            kind: "note",
            mime_type: "text/markdown",
            size_bytes: 0,
            tags: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ];
      },
      getArtifactPath(): string {
        return "/does/not/exist";
      },
    };

    const result = await summarizeArtifacts(store);
    expect(result.suggested_reffy_references).toEqual([]);
  });
});
