import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { addArtifact, createTempRepo } from "./helpers.js";

const execFileAsync = promisify(execFile);

async function runCli(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const { stdout, stderr } = await execFileAsync("node", ["dist/cli.js", ...args], {
      cwd: process.cwd(),
      env: process.env,
    });
    return { stdout, stderr, code: 0 };
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string; code?: number };
    return { stdout: e.stdout ?? "", stderr: e.stderr ?? "", code: e.code ?? 1 };
  }
}

describe("cli summarize", () => {
  it("prints structured text output", async () => {
    const repo = await createTempRepo();
    await addArtifact(repo, {
      filename: "idea.md",
      content: "# Feature Idea: Summary\n\n## Open Questions\n- Should this print?",
    });

    const result = await runCli(["summarize", "--repo", repo.repoRoot, "--output", "text"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Themes:");
    expect(result.stdout).toContain("Open Questions:");
    expect(result.stdout).toContain("Suggested Reffy References:");
  });

  it("returns machine-readable json output", async () => {
    const repo = await createTempRepo();
    await addArtifact(repo, {
      filename: "idea.md",
      content: "# Feature Idea: Summary\n\n## Proposed Feature\n- `reffy summarize`",
    });

    const result = await runCli(["summarize", "--repo", repo.repoRoot, "--output", "json"]);
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      status: string;
      command: string;
      themes: string[];
      suggested_reffy_references: Array<{ filename: string }>;
    };
    expect(parsed.status).toBe("ok");
    expect(parsed.command).toBe("summarize");
    expect(parsed.themes.length).toBeGreaterThan(0);
    expect(parsed.suggested_reffy_references[0]?.filename).toBe("idea.md");
  });

  it("fails summarize when manifest is invalid", async () => {
    const repo = await createTempRepo();
    await writeFile(path.join(repo.manifestPath), "not-json", "utf8");

    const textResult = await runCli(["summarize", "--repo", repo.repoRoot, "--output", "text"]);
    expect(textResult.code).toBe(1);
    expect(textResult.stderr).toContain("Cannot summarize: manifest invalid");

    const jsonResult = await runCli(["summarize", "--repo", repo.repoRoot, "--output", "json"]);
    expect(jsonResult.code).toBe(1);
    const parsed = JSON.parse(jsonResult.stdout) as { status: string; command: string; ok: boolean };
    expect(parsed.status).toBe("error");
    expect(parsed.command).toBe("summarize");
    expect(parsed.ok).toBe(false);
  });
});
