import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

import { validateManifest } from "./manifest.js";
import { resolveRefsDirName } from "./refs-paths.js";

type CheckLevel = "required" | "optional";

export interface DoctorCheck {
  id: string;
  level: CheckLevel;
  ok: boolean;
  message: string;
}

export interface DoctorReport {
  checks: DoctorCheck[];
  summary: {
    required_total: number;
    required_failed: number;
    optional_total: number;
    optional_failed: number;
  };
}

export interface DoctorOptions {
  checkOpenSpec?: () => boolean;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function defaultOpenSpecCheck(): boolean {
  const result = spawnSync("openspec", ["--version"], { stdio: "ignore" });
  return result.error === undefined;
}

function summarizeChecks(checks: DoctorCheck[]): DoctorReport["summary"] {
  const required = checks.filter((check) => check.level === "required");
  const optional = checks.filter((check) => check.level === "optional");

  return {
    required_total: required.length,
    required_failed: required.filter((check) => !check.ok).length,
    optional_total: optional.length,
    optional_failed: optional.filter((check) => !check.ok).length,
  };
}

export async function runDoctor(repoRoot: string, options?: DoctorOptions): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [];
  const refsDirName = resolveRefsDirName(repoRoot);
  const refsDir = path.join(repoRoot, refsDirName);
  const artifactsDir = path.join(refsDir, "artifacts");
  const manifestPath = path.join(refsDir, "manifest.json");
  const rootAgentsPath = path.join(repoRoot, "AGENTS.md");
  const refsAgentsPath = path.join(refsDir, "AGENTS.md");

  const refsDirExists = await pathExists(refsDir);
  checks.push({
    id: "refs_dir_exists",
    level: "required",
    ok: refsDirExists,
    message: refsDirExists ? `${refsDirName} directory found` : `${refsDirName} directory is missing`,
  });

  const artifactsDirExists = await pathExists(artifactsDir);
  checks.push({
    id: "artifacts_dir_exists",
    level: "required",
    ok: artifactsDirExists,
    message: artifactsDirExists
      ? `${refsDirName}/artifacts directory found`
      : `${refsDirName}/artifacts directory is missing`,
  });

  const rootAgentsExists = await pathExists(rootAgentsPath);
  checks.push({
    id: "root_agents_exists",
    level: "required",
    ok: rootAgentsExists,
    message: rootAgentsExists ? "AGENTS.md found" : "AGENTS.md is missing",
  });

  const refsAgentsExists = await pathExists(refsAgentsPath);
  checks.push({
    id: "refs_agents_exists",
    level: "required",
    ok: refsAgentsExists,
    message: refsAgentsExists ? `${refsDirName}/AGENTS.md found` : `${refsDirName}/AGENTS.md is missing`,
  });

  const manifestExists = await pathExists(manifestPath);
  if (!manifestExists) {
    checks.push({
      id: "manifest_valid",
      level: "required",
      ok: false,
      message: `${refsDirName}/manifest.json is missing`,
    });
  } else {
    const manifestResult = await validateManifest(manifestPath, artifactsDir);
    checks.push({
      id: "manifest_valid",
      level: "required",
      ok: manifestResult.ok,
      message: manifestResult.ok
        ? `${refsDirName}/manifest.json is valid (artifacts=${String(manifestResult.artifact_count)})`
        : `manifest invalid: ${manifestResult.errors.join("; ")}`,
    });
  }

  const checkOpenSpec = options?.checkOpenSpec ?? defaultOpenSpecCheck;
  const hasOpenSpec = checkOpenSpec();
  checks.push({
    id: "openspec_available",
    level: "optional",
    ok: hasOpenSpec,
    message: hasOpenSpec ? "openspec command is available" : "openspec command not found on PATH",
  });

  return { checks, summary: summarizeChecks(checks) };
}
