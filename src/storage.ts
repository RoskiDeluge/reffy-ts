import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";

import { inferArtifactType, MANIFEST_VERSION, validateManifest } from "./manifest.js";
import type { Artifact, Manifest } from "./types.js";

function utcNow(): string {
  return new Date().toISOString();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class ReferencesStore {
  public readonly repoRoot: string;
  public readonly refsDir: string;
  public readonly artifactsDir: string;
  public readonly manifestPath: string;

  constructor(repoRoot: string) {
    this.repoRoot = repoRoot;
    this.refsDir = path.join(repoRoot, ".references");
    this.artifactsDir = path.join(this.refsDir, "artifacts");
    this.manifestPath = path.join(this.refsDir, "manifest.json");
    this.ensureStructure();
  }

  private ensureStructure(): void {
    mkdirSync(this.refsDir, { recursive: true });
    mkdirSync(this.artifactsDir, { recursive: true });
    void fs.access(this.manifestPath).catch(async () => {
      await this.writeManifest(this.emptyManifest());
    });
  }

  private emptyManifest(): Manifest {
    const now = utcNow();
    return {
      version: MANIFEST_VERSION,
      created_at: now,
      updated_at: now,
      artifacts: [],
    };
  }

  private async readManifest(): Promise<Manifest> {
    let raw: unknown;
    try {
      const text = await fs.readFile(this.manifestPath, "utf8");
      raw = JSON.parse(text) as unknown;
    } catch {
      return this.emptyManifest();
    }

    if (Array.isArray(raw)) {
      return {
        version: 0,
        created_at: utcNow(),
        updated_at: utcNow(),
        artifacts: raw as Artifact[],
      };
    }

    if (!isObject(raw)) {
      return this.emptyManifest();
    }

    const artifacts = Array.isArray(raw.artifacts) ? (raw.artifacts as Artifact[]) : [];
    return {
      version: typeof raw.version === "number" ? raw.version : MANIFEST_VERSION,
      created_at: typeof raw.created_at === "string" ? raw.created_at : utcNow(),
      updated_at: typeof raw.updated_at === "string" ? raw.updated_at : utcNow(),
      artifacts,
    };
  }

  private async writeManifest(manifest: Manifest): Promise<void> {
    await fs.writeFile(this.manifestPath, JSON.stringify(manifest, null, 2));
  }

  public async listArtifacts(): Promise<Artifact[]> {
    const manifest = await this.readManifest();
    return manifest.artifacts;
  }

  public async getArtifact(artifactId: string): Promise<Artifact | null> {
    const manifest = await this.readManifest();
    return manifest.artifacts.find((item) => item.id === artifactId) ?? null;
  }

  public getArtifactPath(artifact: Artifact): string {
    return path.join(this.artifactsDir, artifact.filename);
  }

  private slugify(name: string): string {
    const cleaned = name
      .split("")
      .filter((ch) => /[\w\- ]/.test(ch))
      .join("")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase();
    return cleaned || "untitled";
  }

  private async uniqueFilename(base: string, ext = ".md"): Promise<string> {
    let candidate = `${base}${ext}`;
    let counter = 2;
    while (true) {
      try {
        await fs.access(path.join(this.artifactsDir, candidate));
        candidate = `${base}-${counter}${ext}`;
        counter += 1;
      } catch {
        return candidate;
      }
    }
  }

  public async createArtifact(input: {
    name: string;
    content?: string | null;
    kind?: string | null;
    mime_type?: string | null;
    tags?: string[] | null;
  }): Promise<Artifact> {
    const id = randomUUID();
    const safe = this.slugify(input.name);
    const filename = await this.uniqueFilename(safe, ".md");
    const now = utcNow();
    const artifactPath = path.join(this.artifactsDir, filename);

    if (input.content !== undefined && input.content !== null) {
      await fs.writeFile(artifactPath, input.content, "utf8");
    }

    let sizeBytes = 0;
    try {
      const stat = await fs.stat(artifactPath);
      sizeBytes = stat.size;
    } catch {
      sizeBytes = 0;
    }

    const artifact: Artifact = {
      id,
      name: input.name,
      filename,
      kind: input.kind ?? "note",
      mime_type: input.mime_type ?? "text/markdown",
      size_bytes: sizeBytes,
      tags: input.tags ?? [],
      created_at: now,
      updated_at: now,
    };

    const manifest = await this.readManifest();
    manifest.updated_at = utcNow();
    manifest.artifacts.push(artifact);
    await this.writeManifest(manifest);
    return artifact;
  }

  public async reindexArtifacts(): Promise<{ added: number; removed: number; total: number }> {
    const manifest = await this.readManifest();
    const entries = await fs.readdir(this.artifactsDir, { withFileTypes: true });
    const filesOnDisk = new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name));
    const beforeCount = manifest.artifacts.length;
    manifest.artifacts = manifest.artifacts.filter((artifact) => filesOnDisk.has(artifact.filename));
    const removed = beforeCount - manifest.artifacts.length;
    const known = new Set(manifest.artifacts.map((a) => a.filename));
    let added = 0;

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (known.has(entry.name)) continue;
      const filePath = path.join(this.artifactsDir, entry.name);
      const stats = await fs.stat(filePath);
      const now = utcNow();
      const inferred = inferArtifactType(filePath);
      const artifact: Artifact = {
        id: randomUUID(),
        name: path.basename(entry.name, path.extname(entry.name)).replace(/-/g, " ").trim() || "untitled",
        filename: entry.name,
        kind: inferred.kind,
        mime_type: inferred.mime_type,
        size_bytes: stats.size,
        tags: [],
        created_at: now,
        updated_at: now,
      };
      manifest.artifacts.push(artifact);
      added += 1;
    }

    if (added > 0 || removed > 0) {
      manifest.updated_at = utcNow();
      await this.writeManifest(manifest);
    }

    return { added, removed, total: manifest.artifacts.length };
  }

  public async validateManifest() {
    return validateManifest(this.manifestPath, this.artifactsDir);
  }

  public async updateArtifact(
    artifactId: string,
    input: {
      name?: string | null;
      content?: string | null;
      kind?: string | null;
      mime_type?: string | null;
      tags?: string[] | null;
    },
  ): Promise<Artifact | null> {
    const manifest = await this.readManifest();
    const index = manifest.artifacts.findIndex((item) => item.id === artifactId);
    if (index === -1) return null;

    const item = manifest.artifacts[index];
    if (input.name !== undefined && input.name !== null) item.name = input.name;
    if (input.kind !== undefined && input.kind !== null) item.kind = input.kind;
    if (input.mime_type !== undefined && input.mime_type !== null) item.mime_type = input.mime_type;
    if (input.tags !== undefined && input.tags !== null) item.tags = input.tags;

    if (input.content !== undefined && input.content !== null) {
      const artifactPath = this.getArtifactPath(item);
      await fs.writeFile(artifactPath, input.content, "utf8");
      const stat = await fs.stat(artifactPath);
      item.size_bytes = stat.size;
    }

    item.updated_at = utcNow();
    manifest.updated_at = utcNow();
    manifest.artifacts[index] = item;
    await this.writeManifest(manifest);
    return item;
  }

  public async deleteArtifact(artifactId: string): Promise<boolean> {
    const manifest = await this.readManifest();
    const index = manifest.artifacts.findIndex((item) => item.id === artifactId);
    if (index === -1) return false;

    const [removed] = manifest.artifacts.splice(index, 1);
    const artifactPath = this.getArtifactPath(removed);
    await fs.rm(artifactPath, { force: true });

    manifest.updated_at = utcNow();
    await this.writeManifest(manifest);
    return true;
  }

}
