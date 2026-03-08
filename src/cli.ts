#!/usr/bin/env node
import { createRequire } from "node:module";
import { existsSync, promises as fs, statSync } from "node:fs";
import path from "node:path";

import { renderDiagram } from "./diagram.js";
import { runDoctor } from "./doctor.js";
import { DEFAULT_REFS_DIRNAME, looksLikeRefsDir, resolveRefsDirName } from "./refs-paths.js";
import { ReferencesStore } from "./storage.js";
import { summarizeArtifacts } from "./summarize.js";

const require = createRequire(import.meta.url);
const { version: packageVersion } = require("../package.json") as { version: string };

const REFFY_ASCII = [
  "            __  __      ",
  " _ __ ___  / _|/ _|_   _",
  "| '__/ _ \\| |_| |_| | | |",
  "| | |  __/|  _|  _| |_| |",
  "|_|  \\___||_| |_|  \\__, |",
  "                   |___/ ",
].join("\n");

function buildReffyBlock(refsDirName: string): string {
  return `<!-- REFFY:START -->
# Reffy Instructions

These instructions are for AI assistants working in this project.

Always open \`@/${refsDirName}/AGENTS.md\` when the request:
- Mentions early-stage ideation, exploration, brainstorming, or raw notes
- Needs context before drafting specs or proposals
- Refers to "reffy", "references", "explore", or "context layer"

Use \`@/${refsDirName}/AGENTS.md\` to learn:
- Reffy workflow and artifact conventions
- How Reffy and OpenSpec should be sequenced
- How to store and consume ideation context in \`${refsDirName}/\`

Keep this managed block so \`reffy init\` can refresh the instructions.

<!-- REFFY:END -->`;
}

function buildReffyAgentsContent(refsDirName: string): string {
  return `# Reffy Instructions

These instructions are for AI assistants working in this project.

## TL;DR Checklist

- Decide whether Reffy ideation is needed for this request.
- If needed, read existing context in \`${refsDirName}/artifacts/\`.
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

1. Read existing artifacts in \`${refsDirName}/artifacts/\`.
2. Add or update artifacts to capture exploratory context.
3. Run \`reffy reindex\` to index newly added files into \`${refsDirName}/manifest.json\`.
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

- Treat \`${refsDirName}/\` as a repository-local guidance and ideation context layer.
- Keep artifact names clear and stable.
- Prefer markdown notes for exploratory content.
- Keep manifests machine-readable and schema-compliant (version 1).
`;
}

const REFFY_START = "<!-- REFFY:START -->";
const REFFY_END = "<!-- REFFY:END -->";
const OPENSPEC_START = "<!-- OPENSPEC:START -->";

function upsertReffyBlock(content: string): string {
  return upsertReffyBlockForDir(content, DEFAULT_REFS_DIRNAME);
}

function upsertReffyBlockForDir(content: string, refsDirName: string): string {
  const reffyBlock = buildReffyBlock(refsDirName);
  if (content.includes(REFFY_START) && content.includes(REFFY_END)) {
    const prefix = content.split(REFFY_START)[0] ?? "";
    const suffix = content.split(REFFY_END, 2)[1] ?? "";
    const trimmedSuffix = suffix.trimStart();
    return trimmedSuffix.length > 0 ? `${prefix}${reffyBlock}\n\n${trimmedSuffix}` : `${prefix}${reffyBlock}\n`;
  }

  if (content.includes(OPENSPEC_START)) {
    const [before, after] = content.split(OPENSPEC_START, 2);
    return `${before.trimEnd()}\n\n${reffyBlock}\n\n${OPENSPEC_START}${after}`;
  }

  return content.trim().length > 0 ? `${reffyBlock}\n\n${content.trimStart()}` : `${reffyBlock}\n`;
}

async function initAgents(repoRoot: string): Promise<{ root_agents_path: string; reffy_agents_path: string }> {
  const refsDirName = resolveRefsDirName(repoRoot);
  const agentsPath = path.join(repoRoot, "AGENTS.md");
  const reffyAgentsPath = path.join(repoRoot, refsDirName, "AGENTS.md");
  let content = "";
  try {
    content = await fs.readFile(agentsPath, "utf8");
  } catch {
    content = "";
  }

  const updated = upsertReffyBlockForDir(content, refsDirName);
  await fs.mkdir(path.dirname(reffyAgentsPath), { recursive: true });
  await fs.writeFile(agentsPath, updated, "utf8");
  await fs.writeFile(reffyAgentsPath, buildReffyAgentsContent(refsDirName), "utf8");
  return { root_agents_path: agentsPath, reffy_agents_path: reffyAgentsPath };
}

function pathExists(targetPath: string): boolean {
  return existsSync(targetPath);
}

function isDirectory(targetPath: string): boolean {
  try {
    return statSync(targetPath).isDirectory();
  } catch {
    return false;
  }
}

function discoverRepoRoot(startDir: string): string {
  let current = path.resolve(startDir);

  while (true) {
    if (looksLikeRefsDir(current)) {
      return path.dirname(current);
    }

    if (isDirectory(path.join(current, DEFAULT_REFS_DIRNAME)) || isDirectory(path.join(current, ".references"))) {
      return current;
    }

    if (pathExists(path.join(current, "AGENTS.md")) || pathExists(path.join(current, ".git"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return path.resolve(startDir);
    }
    current = parent;
  }
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
  return discoverRepoRoot(process.cwd());
}

type OutputMode = "text" | "json";
type DiagramFormat = "svg" | "ascii";

interface DiagramCliArgs {
  repoRoot: string;
  inputPath?: string;
  stdin: boolean;
  format: DiagramFormat;
  outputPath?: string;
  theme?: string;
  bg?: string;
  fg?: string;
  line?: string;
  accent?: string;
  muted?: string;
  surface?: string;
  border?: string;
  font?: string;
}

type DiagramStringOptionKey = "theme" | "bg" | "fg" | "line" | "accent" | "muted" | "surface" | "border" | "font";

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
    "Flags:",
    "  --version  Print the installed reffy package version.",
    "",
    "Commands:",
    "  init       Ensure root AGENTS.md block and .reffy/AGENTS.md are up to date.",
    "  bootstrap  Run init, ensure .reffy structure exists, then reindex artifacts.",
    "  doctor     Diagnose required Reffy setup and optional tool availability.",
    "  reindex    Scan .reffy/artifacts and add missing files to manifest.",
    "  validate   Validate .reffy/manifest.json against manifest v1 contract.",
    "  summarize  Generate a read-only summary of indexed Reffy artifacts.",
    "  diagram    Render Mermaid diagrams (supports SVG and ASCII).",
  ].join("\n");
}

function diagramUsage(): string {
  return [
    "Usage: reffy diagram render [--repo PATH] [--input PATH|--stdin] [--format svg|ascii] [--output PATH]",
    "",
    "Options:",
    "  --input PATH      Read Mermaid (or OpenSpec spec.md) from file",
    "  --stdin           Read Mermaid text from stdin",
    "  --format VALUE    Output format: svg (default) or ascii",
    "  --output PATH     Write rendered result to file instead of stdout",
    "  --theme NAME      Apply built-in SVG theme (beautiful-mermaid)",
    "  --bg HEX          SVG color override for background",
    "  --fg HEX          SVG color override for foreground",
    "  --line HEX        SVG color override for connector lines",
    "  --accent HEX      SVG color override for accents/arrowheads",
    "  --muted HEX       SVG color override for secondary text",
    "  --surface HEX     SVG color override for node surfaces",
    "  --border HEX      SVG color override for node borders",
    "  --font NAME       SVG font family override",
  ].join("\n");
}

function parseDiagramArgs(argv: string[]): DiagramCliArgs {
  const repoRoot = parseRepoArg(argv);
  const args: DiagramCliArgs = {
    repoRoot,
    stdin: false,
    format: "svg",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--repo") {
      i += 1;
      continue;
    }
    if (arg.startsWith("--repo=")) continue;

    if (arg === "--stdin") {
      args.stdin = true;
      continue;
    }
    if (arg === "--input") {
      const value = argv[i + 1];
      if (!value) throw new Error("--input requires a path");
      args.inputPath = value;
      i += 1;
      continue;
    }
    if (arg.startsWith("--input=")) {
      const value = arg.split("=", 2)[1];
      if (!value) throw new Error("--input requires a path");
      args.inputPath = value;
      continue;
    }
    if (arg === "--output") {
      const value = argv[i + 1];
      if (!value) throw new Error("--output requires a path");
      args.outputPath = value;
      i += 1;
      continue;
    }
    if (arg.startsWith("--output=")) {
      const value = arg.split("=", 2)[1];
      if (!value) throw new Error("--output requires a path");
      args.outputPath = value;
      continue;
    }
    if (arg === "--format") {
      const value = argv[i + 1];
      if (!value) throw new Error("--format requires a value: svg|ascii");
      if (value !== "svg" && value !== "ascii") throw new Error(`Unsupported format: ${value}. Valid formats: svg, ascii`);
      args.format = value;
      i += 1;
      continue;
    }
    if (arg.startsWith("--format=")) {
      const value = arg.split("=", 2)[1];
      if (value !== "svg" && value !== "ascii") throw new Error(`Unsupported format: ${value}. Valid formats: svg, ascii`);
      args.format = value;
      continue;
    }

    const keyMap: Record<string, DiagramStringOptionKey> = {
      "--theme": "theme",
      "--bg": "bg",
      "--fg": "fg",
      "--line": "line",
      "--accent": "accent",
      "--muted": "muted",
      "--surface": "surface",
      "--border": "border",
      "--font": "font",
    };

    const directKey = keyMap[arg];
    if (directKey) {
      const value = argv[i + 1];
      if (!value) throw new Error(`${arg} requires a value`);
      args[directKey] = value;
      i += 1;
      continue;
    }

    const inline = Object.entries(keyMap).find(([flag]) => arg.startsWith(`${flag}=`));
    if (inline) {
      const [flag, key] = inline;
      const value = arg.slice(flag.length + 1);
      if (!value) throw new Error(`${flag} requires a value`);
      args[key] = value;
      continue;
    }

    throw new Error(`Unknown diagram option: ${arg}`);
  }

  return args;
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

  if (!command || command === "--help" || command === "-h") {
    console.error(usage());
    return command ? 0 : 1;
  }

  if (command === "--version") {
    console.log(packageVersion);
    return 0;
  }

  if (command === "diagram") {
    const [subcommand, ...diagramArgs] = rest;
    if (!subcommand || subcommand === "--help" || subcommand === "-h") {
      console.error(diagramUsage());
      return 1;
    }
    if (subcommand !== "render") {
      console.error(`Unknown diagram subcommand: ${subcommand}`);
      console.error(diagramUsage());
      return 1;
    }

    const parsed = parseDiagramArgs(diagramArgs);
    const rendered = await renderDiagram({
      repoRoot: parsed.repoRoot,
      inputPath: parsed.inputPath,
      stdin: parsed.stdin,
      format: parsed.format,
      outputPath: parsed.outputPath,
      theme: parsed.theme,
      bg: parsed.bg,
      fg: parsed.fg,
      line: parsed.line,
      accent: parsed.accent,
      muted: parsed.muted,
      surface: parsed.surface,
      border: parsed.border,
      font: parsed.font,
    });

    if (parsed.outputPath) {
      console.log(`Wrote ${parsed.format} diagram to ${path.isAbsolute(parsed.outputPath) ? parsed.outputPath : path.join(parsed.repoRoot, parsed.outputPath)}`);
      return 0;
    }

    process.stdout.write(rendered.content);
    if (!rendered.content.endsWith("\n")) {
      process.stdout.write("\n");
    }
    return 0;
  }

  const output = parseOutputMode(rest);

  if (command === "init") {
    printBanner(output);
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

  if (command === "doctor") {
    const repoRoot = parseRepoArg(rest);
    const report = await runDoctor(repoRoot);
    const status = report.summary.required_failed > 0 ? "error" : "ok";
    const payload = { status, command: "doctor", ...report };
    if (output === "json") {
      printResult(output, payload);
    } else {
      const required = report.checks.filter((check) => check.level === "required");
      const optional = report.checks.filter((check) => check.level === "optional");

      console.log("Required Checks:");
      for (const check of required) {
        console.log(`- ${check.ok ? "PASS" : "FAIL"} ${check.id}: ${check.message}`);
      }
      console.log("");
      console.log("Optional Checks:");
      for (const check of optional) {
        console.log(`- ${check.ok ? "PASS" : "WARN"} ${check.id}: ${check.message}`);
      }
      console.log("");
      console.log(
        `Summary: required_failed=${String(report.summary.required_failed)} optional_failed=${String(report.summary.optional_failed)}`,
      );
    }
    return status === "ok" ? 0 : 1;
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
