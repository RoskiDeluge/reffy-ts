import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { Artifact } from "../src/types.js";

function nowIso(): string {
  return new Date().toISOString();
}

export async function createTempRepo(): Promise<{ repoRoot: string; refsDir: string; artifactsDir: string; manifestPath: string }> {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "reffy-test-"));
  const refsDir = path.join(repoRoot, ".references");
  const artifactsDir = path.join(refsDir, "artifacts");
  const manifestPath = path.join(refsDir, "manifest.json");

  await mkdir(artifactsDir, { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        version: 1,
        created_at: nowIso(),
        updated_at: nowIso(),
        artifacts: [],
      },
      null,
      2,
    ),
    "utf8",
  );

  return { repoRoot, refsDir, artifactsDir, manifestPath };
}

export async function addArtifact(
  repo: { artifactsDir: string; manifestPath: string },
  input: { filename: string; content: string; kind?: string; mime_type?: string; name?: string },
): Promise<Artifact> {
  await writeFile(path.join(repo.artifactsDir, input.filename), input.content, "utf8");
  const stats = await (await import("node:fs/promises")).stat(path.join(repo.artifactsDir, input.filename));

  const artifact: Artifact = {
    id: randomUUID(),
    name: input.name ?? path.basename(input.filename, path.extname(input.filename)),
    filename: input.filename,
    kind: input.kind ?? "note",
    mime_type: input.mime_type ?? "text/markdown",
    size_bytes: stats.size,
    tags: [],
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  const manifest = JSON.parse(await readFile(repo.manifestPath, "utf8")) as {
    version: number;
    created_at: string;
    updated_at: string;
    artifacts: Artifact[];
  };
  manifest.artifacts.push(artifact);
  manifest.updated_at = nowIso();
  await writeFile(repo.manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  return artifact;
}
