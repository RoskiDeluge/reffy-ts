import { execFile, spawn } from "node:child_process";
import { access, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { addArtifact, createTempRepo, createTempRepoWithRefsDir } from "./helpers.js";

const execFileAsync = promisify(execFile);
const CLI_PATH = path.join(process.cwd(), "dist/cli.js");

async function runCli(args: string[], cwd = process.cwd()): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const { stdout, stderr } = await execFileAsync("node", [CLI_PATH, ...args], {
      cwd,
      env: process.env,
    });
    return { stdout, stderr, code: 0 };
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string; code?: number };
    return { stdout: e.stdout ?? "", stderr: e.stderr ?? "", code: e.code ?? 1 };
  }
}

async function runCliWithStdin(
  args: string[],
  input: string,
  cwd = process.cwd(),
): Promise<{ stdout: string; stderr: string; code: number }> {
  return await new Promise((resolve) => {
    const child = spawn("node", [CLI_PATH, ...args], {
      cwd,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      resolve({ stdout, stderr, code: code ?? 1 });
    });

    child.stdin.write(input);
    child.stdin.end();
  });
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
    expect(result.stdout).not.toContain("__  __");
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

describe("cli init", () => {
  it("prints ASCII banner in text output", async () => {
    const repo = await createTempRepo();
    const result = await runCli(["init", "--repo", repo.repoRoot, "--output", "text"]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("__  __");
    expect(result.stdout).toContain("Updated");
  });
});

describe("cli version", () => {
  it("prints the installed package version", async () => {
    const packageJson = JSON.parse(await readFile(path.join(process.cwd(), "package.json"), "utf8")) as { version: string };

    const result = await runCli(["--version"]);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout.trim()).toBe(packageJson.version);
  });
});

describe("cli repo-root discovery", () => {
  it("uses the repository root when commands run from .reffy/artifacts", async () => {
    const repo = await createTempRepo();
    const cwd = repo.artifactsDir;
    const nestedRefsPath = path.join(repo.artifactsDir, ".reffy");

    const reindex = await runCli(["reindex", "--output", "json"], cwd);
    expect(reindex.code).toBe(0);

    const validate = await runCli(["validate", "--output", "json"], cwd);
    expect(validate.code).toBe(0);

    const summarize = await runCli(["summarize", "--output", "json"], cwd);
    expect(summarize.code).toBe(0);

    const doctor = await runCli(["doctor", "--output", "json"], cwd);
    expect(doctor.code).toBe(0);

    const init = await runCli(["init", "--output", "json"], cwd);
    expect(init.code).toBe(0);

    const bootstrap = await runCli(["bootstrap", "--output", "json"], cwd);
    expect(bootstrap.code).toBe(0);

    const initPayload = JSON.parse(init.stdout) as { root_agents_path: string; reffy_agents_path: string };
    expect(await realpath(initPayload.root_agents_path)).toBe(await realpath(path.join(repo.repoRoot, "AGENTS.md")));
    expect(await realpath(initPayload.reffy_agents_path)).toBe(
      await realpath(path.join(repo.repoRoot, ".reffy", "AGENTS.md")),
    );

    const bootstrapPayload = JSON.parse(bootstrap.stdout) as { refs_dir: string; manifest_path: string };
    expect(await realpath(bootstrapPayload.refs_dir)).toBe(await realpath(path.join(repo.repoRoot, ".reffy")));
    expect(await realpath(bootstrapPayload.manifest_path)).toBe(
      await realpath(path.join(repo.repoRoot, ".reffy", "manifest.json")),
    );

    await expect(access(nestedRefsPath)).rejects.toThrow();
  });

  it("uses the repository root when commands run from .references/artifacts", async () => {
    const repo = await createTempRepoWithRefsDir(".references");
    const cwd = repo.artifactsDir;
    const nestedRefsPath = path.join(repo.artifactsDir, ".reffy");

    const reindex = await runCli(["reindex", "--output", "json"], cwd);
    expect(reindex.code).toBe(0);

    const validate = await runCli(["validate", "--output", "json"], cwd);
    expect(validate.code).toBe(0);

    const summarize = await runCli(["summarize", "--output", "json"], cwd);
    expect(summarize.code).toBe(0);

    const doctor = await runCli(["doctor", "--output", "json"], cwd);
    expect(doctor.code).toBe(0);

    const init = await runCli(["init", "--output", "json"], cwd);
    expect(init.code).toBe(0);

    const bootstrap = await runCli(["bootstrap", "--output", "json"], cwd);
    expect(bootstrap.code).toBe(0);

    const initPayload = JSON.parse(init.stdout) as { root_agents_path: string; reffy_agents_path: string };
    expect(await realpath(initPayload.root_agents_path)).toBe(await realpath(path.join(repo.repoRoot, "AGENTS.md")));
    expect(await realpath(initPayload.reffy_agents_path)).toBe(
      await realpath(path.join(repo.repoRoot, ".references", "AGENTS.md")),
    );

    const bootstrapPayload = JSON.parse(bootstrap.stdout) as { refs_dir: string; manifest_path: string };
    expect(await realpath(bootstrapPayload.refs_dir)).toBe(await realpath(path.join(repo.repoRoot, ".references")));
    expect(await realpath(bootstrapPayload.manifest_path)).toBe(
      await realpath(path.join(repo.repoRoot, ".references", "manifest.json")),
    );

    await expect(access(nestedRefsPath)).rejects.toThrow();
  });
});

describe("cli legacy .references compatibility", () => {
  it("refreshes AGENTS instructions in-place for an existing .references repo", async () => {
    const repo = await createTempRepoWithRefsDir(".references");

    const init = await runCli(["init", "--repo", repo.repoRoot, "--output", "json"]);
    expect(init.code).toBe(0);

    const rootAgents = await readFile(path.join(repo.repoRoot, "AGENTS.md"), "utf8");
    const refsAgents = await readFile(path.join(repo.repoRoot, ".references", "AGENTS.md"), "utf8");

    expect(rootAgents).toContain("`@/.references/AGENTS.md`");
    expect(rootAgents).not.toContain("`@/.reffy/AGENTS.md`");
    expect(refsAgents).toContain("`.references/artifacts/`");
    await expect(access(path.join(repo.repoRoot, ".reffy"))).rejects.toThrow();
  });
});

describe("cli doctor", () => {
  it("prints required/optional sections in text mode", async () => {
    const repo = await createTempRepo();
    const result = await runCli(["doctor", "--repo", repo.repoRoot, "--output", "text"]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Required Checks:");
    expect(result.stdout).toContain("Optional Checks:");
    expect(result.stdout).toContain("Summary:");
  });

  it("returns structured json payload", async () => {
    const repo = await createTempRepo();
    const result = await runCli(["doctor", "--repo", repo.repoRoot, "--output", "json"]);

    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      status: string;
      command: string;
      checks: Array<{ id: string; level: string; ok: boolean; message: string }>;
      summary: { required_failed: number };
    };
    expect(parsed.status).toBe("ok");
    expect(parsed.command).toBe("doctor");
    expect(parsed.summary.required_failed).toBe(0);
    expect(parsed.checks.some((check) => check.id === "manifest_valid")).toBe(true);
  });

  it("returns non-zero when required checks fail", async () => {
    const repo = await createTempRepo();
    await writeFile(repo.manifestPath, "not-json", "utf8");

    const result = await runCli(["doctor", "--repo", repo.repoRoot, "--output", "json"]);
    expect(result.code).toBe(1);
    const parsed = JSON.parse(result.stdout) as { status: string; summary: { required_failed: number } };
    expect(parsed.status).toBe("error");
    expect(parsed.summary.required_failed).toBeGreaterThan(0);
  });
});

describe("cli diagram render", () => {
  it("renders svg from stdin", async () => {
    const result = await runCliWithStdin(
      ["diagram", "render", "--format", "svg", "--stdin"],
      "graph TD\n  A[Start] --> B[End]\n",
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("<svg");
  });

  it("renders ascii from stdin", async () => {
    const result = await runCliWithStdin(
      ["diagram", "render", "--format", "ascii", "--stdin"],
      "graph LR\n  A --> B\n",
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("A");
    expect(result.stdout).toContain("B");
  });

  it("derives diagram relationships from generated spec.md input", async () => {
    const repo = await createTempRepo();
    const specDir = path.join(repo.repoRoot, "openspec", "specs", "demo");
    const specPath = path.join(specDir, "spec.md");
    await mkdir(specDir, { recursive: true });
    await writeFile(
      specPath,
      [
        "# demo Specification",
        "",
        "## Requirements",
        "### Requirement: User Login",
        "The system SHALL support login.",
        "",
        "#### Scenario: Valid credentials",
        "- **WHEN** the user submits correct credentials",
        "- **THEN** authentication succeeds",
      ].join("\n"),
      "utf8",
    );

    const result = await runCli(["diagram", "render", "--repo", repo.repoRoot, "--input", "openspec/specs/demo/spec.md", "--format", "ascii"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Requirement: User Login");
    expect(result.stdout).toContain("Scenario: Valid credentials");
  });

  it("writes output to file when --output is provided", async () => {
    const repo = await createTempRepo();
    const result = await runCliWithStdin(
      ["diagram", "render", "--repo", repo.repoRoot, "--stdin", "--format", "svg", "--output", "out/diagram.svg"],
      "graph TD\n  A --> B\n",
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Wrote svg diagram to");
    const written = await readFile(path.join(repo.repoRoot, "out", "diagram.svg"), "utf8");
    expect(written).toContain("<svg");
  });

  it("fails for invalid mermaid input", async () => {
    const result = await runCliWithStdin(["diagram", "render", "--format", "svg", "--stdin"], "not-a-mermaid-diagram");
    expect(result.code).toBe(1);
    expect(result.stderr.length).toBeGreaterThan(0);
  });

  it("fails for malformed spec.md input", async () => {
    const repo = await createTempRepo();
    const specDir = path.join(repo.repoRoot, "openspec", "specs", "broken");
    await mkdir(specDir, { recursive: true });
    await writeFile(path.join(specDir, "spec.md"), "# broken spec\n\nNo requirement headings here.\n", "utf8");

    const result = await runCli(["diagram", "render", "--repo", repo.repoRoot, "--input", "openspec/specs/broken/spec.md", "--format", "ascii"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Unable to derive diagram from spec.md");
  });
});
