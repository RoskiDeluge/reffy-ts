#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";

import { ReferencesStore } from "./storage.js";
import { summarizeArtifacts } from "./summarize.js";

const REFFY_ASCII = [
  "             __  __      ",
  " _ __ ___   / _|/ _|_  _",
  "| '__/ _ \\| |_| |_| | | |",
  "| | |  __/ |  _|  _| |_| |",
  "|_|  \\___||_| |_| \\__, |",
  "                    |___/ ",
].join("\n");

const REFFY_BLOCK = `<!-- REFFY:START -->
# Reffy Instructions

These instructions are for AI assistants working in this project.

Always open \`@/.references/AGENTS.md\` when the request:
- Mentions early-stage ideation, exploration, brainstorming, or raw notes
- Needs context before drafting specs or proposals
- Refers to "reffy", "references", "explore", or "context layer"

Use \`@/.references/AGENTS.md\` to learn:
- Reffy workflow and artifact conventions
- How Reffy and OpenSpec should be sequenced
- How to store and consume ideation context in \`.references/\`

Keep this managed block so \`reffy init\` can refresh the instructions.

<!-- REFFY:END -->`;

const REFFY_AGENTS_RELATIVE = path.join(".references", "AGENTS.md");
const REFFY_AGENTS_CONTENT = `# Reffy Instructions

These instructions are for AI assistants working in this project.

## TL;DR Checklist

- Decide whether Reffy ideation is needed for this request.
- If needed, read existing context in \`.references/artifacts/\`.
- Add/update exploratory artifacts and keep them concise.
- Run \`reffy reindex\` and \`reffy validate\` after artifact changes.
- After ideation approval, run \`reffy summarize --output json\` and pick only directly relevant artifacts for proposal citations.

## When To Use Reffy

Use Reffy first when the request:
- Mentions early-stage ideation, exploration, brainstorming, or raw notes
- Needs context gathering before drafting a concrete implementation plan
- Refers to "reffy", "references", "explore", "context layer", or research artifacts

## When To Skip Reffy

You can skip Reffy when the request is:
- A narrow bug fix that does not need exploratory context
- A small refactor with no requirement/design ambiguity
- A formatting, typing, or tooling-only update with clear scope

## Reffy Workflow

1. Read existing artifacts in \`.references/artifacts/\`.
2. Add or update artifacts to capture exploratory context.
3. Run \`reffy reindex\` to index newly added files into \`.references/manifest.json\`.
4. Run \`reffy validate\` to verify manifest contract compliance.

## Relationship To OpenSpec

- Reffy is the ideation/context layer.
- OpenSpec is the formal planning/spec layer.
- After ideation stabilizes, hand off to OpenSpec by following \`@/openspec/AGENTS.md\`.
- Do not duplicate full proposal/spec content in Reffy artifacts; summarize and link to OpenSpec outputs.

## OpenSpec Citation Rules

When an OpenSpec proposal is informed by Reffy artifacts:
- After ideation approval, run \`reffy summarize --output json\` to shortlist candidate artifacts.
- Include a short "Reffy References" subsection in \`proposal.md\` (or design notes if more appropriate).
- Cite only artifact filenames that directly informed the proposal's problem, scope, decisions, or constraints.
- Cite artifact filenames and intent, for example:
  - \`testing.md\` - early constraints and tradeoffs for manifest validation
- Do not include generic process artifacts or unrelated notes just because they exist.
- Keep citations at proposal/design level; task-by-task traceability is optional unless the change is high risk.
- If no Reffy artifacts informed the change, explicitly state "No Reffy references used."

### Reusable Proposal Snippet

Use this in \`openspec/changes/<change-id>/proposal.md\`:

\`\`\`md
## Reffy References
- \`artifact-name.md\` - short note about how it informed this proposal
\`\`\`

If none were used:

\`\`\`md
## Reffy References
No Reffy references used.
\`\`\`

## Artifact Conventions

- Treat \`.references/\` as a repository-local guidance and ideation context layer.
- Keep artifact names clear and stable.
- Prefer markdown notes for exploratory content.
- Keep manifests machine-readable and schema-compliant (version 1).
`;

const REFFY_START = "<!-- REFFY:START -->";
const REFFY_END = "<!-- REFFY:END -->";
const OPENSPEC_START = "<!-- OPENSPEC:START -->";

function upsertReffyBlock(content: string): string {
  if (content.includes(REFFY_START) && content.includes(REFFY_END)) {
    const prefix = content.split(REFFY_START)[0] ?? "";
    const suffix = content.split(REFFY_END, 2)[1] ?? "";
    const trimmedSuffix = suffix.trimStart();
    return trimmedSuffix.length > 0 ? `${prefix}${REFFY_BLOCK}\n\n${trimmedSuffix}` : `${prefix}${REFFY_BLOCK}\n`;
  }

  if (content.includes(OPENSPEC_START)) {
    const [before, after] = content.split(OPENSPEC_START, 2);
    return `${before.trimEnd()}\n\n${REFFY_BLOCK}\n\n${OPENSPEC_START}${after}`;
  }

  return content.trim().length > 0 ? `${REFFY_BLOCK}\n\n${content.trimStart()}` : `${REFFY_BLOCK}\n`;
}

async function initAgents(repoRoot: string): Promise<{ root_agents_path: string; reffy_agents_path: string }> {
  const agentsPath = path.join(repoRoot, "AGENTS.md");
  const reffyAgentsPath = path.join(repoRoot, REFFY_AGENTS_RELATIVE);
  let content = "";
  try {
    content = await fs.readFile(agentsPath, "utf8");
  } catch {
    content = "";
  }

  const updated = upsertReffyBlock(content);
  await fs.mkdir(path.dirname(reffyAgentsPath), { recursive: true });
  await fs.writeFile(agentsPath, updated, "utf8");
  await fs.writeFile(reffyAgentsPath, REFFY_AGENTS_CONTENT, "utf8");
  return { root_agents_path: agentsPath, reffy_agents_path: reffyAgentsPath };
}

function parseRepoArg(argv: string[]): string {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--repo") {
      const value = argv[i + 1];
      if (!value) throw new Error("--repo requires a path");
      return path.resolve(value);
    }
    if (arg.startsWith("--repo=")) {
      const value = arg.split("=", 2)[1];
      if (!value) throw new Error("--repo requires a path");
      return path.resolve(value);
    }
  }
  return process.cwd();
}

type OutputMode = "text" | "json";

function parseOutputMode(argv: string[]): OutputMode {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") return "json";
    if (arg === "--output") {
      const value = argv[i + 1];
      if (!value) throw new Error("--output requires a value: text|json");
      if (value !== "text" && value !== "json") throw new Error(`Unsupported output mode: ${value}`);
      return value;
    }
    if (arg.startsWith("--output=")) {
      const value = arg.split("=", 2)[1];
      if (value !== "text" && value !== "json") throw new Error(`Unsupported output mode: ${value}`);
      return value;
    }
  }
  return "text";
}

function printResult(mode: OutputMode, payload: unknown): void {
  if (mode === "json") {
    console.log(JSON.stringify(payload, null, 2));
  }
}

function printBanner(mode: OutputMode): void {
  if (mode === "text") {
    console.log(REFFY_ASCII);
    console.log("");
  }
}

function usage(): string {
  return [
    "Usage: reffy <command> [--repo PATH] [--output text|json]",
    "",
    "Commands:",
    "  init       Ensure root AGENTS.md block and .references/AGENTS.md are up to date.",
    "  bootstrap  Run init, ensure .references structure exists, then reindex artifacts.",
    "  reindex    Scan .references/artifacts and add missing files to manifest.",
    "  validate   Validate .references/manifest.json against manifest v1 contract.",
    "  summarize  Generate a read-only summary of indexed Reffy artifacts.",
  ].join("\n");
}

function printSection(title: string, values: string[]): void {
  console.log(`${title}:`);
  if (values.length === 0) {
    console.log("- (none)");
    return;
  }
  for (const value of values) {
    console.log(`- ${value}`);
  }
}

async function main(): Promise<number> {
  const [, , command, ...rest] = process.argv;
  const output = parseOutputMode(rest);
  printBanner(output);

  if (!command) {
    console.error(usage());
    return 1;
  }

  if (command === "init") {
    const repoRoot = parseRepoArg(rest);
    const agents = await initAgents(repoRoot);
    const payload = { status: "ok", command: "init", ...agents };
    if (output === "json") {
      printResult(output, payload);
    } else {
      console.log(`Updated ${agents.root_agents_path}`);
      console.log(`Updated ${agents.reffy_agents_path}`);
    }
    return 0;
  }

  if (command === "bootstrap") {
    const repoRoot = parseRepoArg(rest);
    const agents = await initAgents(repoRoot);
    const store = new ReferencesStore(repoRoot);
    const reindex = await store.reindexArtifacts();
    const payload = {
      status: "ok",
      command: "bootstrap",
      ...agents,
      refs_dir: store.refsDir,
      manifest_path: store.manifestPath,
      reindex,
    };
    if (output === "json") {
      printResult(output, payload);
    } else {
      console.log(`Bootstrapped ${store.refsDir}`);
      console.log(`Updated ${agents.root_agents_path}`);
      console.log(`Updated ${agents.reffy_agents_path}`);
      console.log(`Reindex: added=${String(reindex.added)} removed=${String(reindex.removed)} total=${String(reindex.total)}`);
    }
    return 0;
  }

  if (command === "reindex") {
    const repoRoot = parseRepoArg(rest);
    const store = new ReferencesStore(repoRoot);
    const reindex = await store.reindexArtifacts();
    const payload = { status: "ok", command: "reindex", ...reindex };
    if (output === "json") {
      printResult(output, payload);
    } else {
      console.log(
        `Reindex complete: added=${String(reindex.added)} removed=${String(reindex.removed)} total=${String(reindex.total)}`,
      );
    }
    return 0;
  }

  if (command === "validate") {
    const repoRoot = parseRepoArg(rest);
    const store = new ReferencesStore(repoRoot);
    const result = await store.validateManifest();
    const payload = { status: result.ok ? "ok" : "error", command: "validate", ...result };
    if (output === "json") {
      printResult(output, payload);
    } else if (result.ok) {
      console.log(`Manifest valid: artifacts=${String(result.artifact_count)}`);
      if (result.warnings.length > 0) {
        for (const warning of result.warnings) {
          console.log(`warn: ${warning}`);
        }
      }
    } else {
      console.error(`Manifest invalid: ${String(result.errors.length)} error(s)`);
      for (const error of result.errors) {
        console.error(`error: ${error}`);
      }
      for (const warning of result.warnings) {
        console.error(`warn: ${warning}`);
      }
    }
    return result.ok ? 0 : 1;
  }

  if (command === "summarize") {
    const repoRoot = parseRepoArg(rest);
    const store = new ReferencesStore(repoRoot);
    const validation = await store.validateManifest();
    if (!validation.ok) {
      const payload = { status: "error", command: "summarize", ...validation };
      if (output === "json") {
        printResult(output, payload);
      } else {
        console.error(`Cannot summarize: manifest invalid (${String(validation.errors.length)} error(s))`);
        for (const error of validation.errors) {
          console.error(`error: ${error}`);
        }
      }
      return 1;
    }

    const summary = await summarizeArtifacts(store);
    const payload = { status: "ok", command: "summarize", ...summary };
    if (output === "json") {
      printResult(output, payload);
    } else {
      printSection("Themes", summary.themes);
      console.log("");
      printSection("Open Questions", summary.open_questions);
      console.log("");
      printSection("Candidate Changes", summary.candidate_changes);
      console.log("");
      console.log("Suggested Reffy References:");
      if (summary.suggested_reffy_references.length === 0) {
        console.log("- (none)");
      } else {
        for (const reference of summary.suggested_reffy_references) {
          console.log(`- ${reference.filename} - ${reference.reason}`);
        }
      }
    }
    return 0;
  }

  console.error(`Unknown command: ${command}`);
  console.error(usage());
  return 1;
}

void main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(String(error));
    process.exitCode = 1;
  },
);
