import { rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ReferencesStore } from "../src/storage.js";
import { createTempRepo } from "./helpers.js";

describe("ReferencesStore", () => {
  it("creates, updates, and deletes artifacts", async () => {
    const repo = await createTempRepo();
    const store = new ReferencesStore(repo.repoRoot);

    const created = await store.createArtifact({
      name: "Test Artifact",
      content: "hello",
    });

    expect(created.filename).toMatch(/test-artifact/);
    expect((await store.listArtifacts()).length).toBeGreaterThanOrEqual(1);
    expect(await store.getArtifact(created.id)).not.toBeNull();

    const updated = await store.updateArtifact(created.id, {
      name: "Renamed",
      content: "updated content",
      tags: ["x"],
    });

    expect(updated?.name).toBe("Renamed");
    expect(updated?.tags).toEqual(["x"]);

    const deleted = await store.deleteArtifact(created.id);
    expect(deleted).toBe(true);
    expect(await store.getArtifact(created.id)).toBeNull();
  });

  it("reindexes artifacts that exist on disk but not in manifest", async () => {
    const repo = await createTempRepo();
    const store = new ReferencesStore(repo.repoRoot);

    await writeFile(path.join(store.artifactsDir, "new-note.md"), "note", "utf8");
    const result = await store.reindexArtifacts();

    expect(result.added).toBe(1);
    const artifacts = await store.listArtifacts();
    expect(artifacts.some((a) => a.filename === "new-note.md")).toBe(true);
  });

  it("removes manifest entries for files deleted from artifacts directory", async () => {
    const repo = await createTempRepo();
    const store = new ReferencesStore(repo.repoRoot);

    const created = await store.createArtifact({
      name: "to delete",
      content: "remove me",
    });
    await rm(path.join(store.artifactsDir, created.filename), { force: true });

    const result = await store.reindexArtifacts();
    expect(result.removed).toBe(1);
    expect(result.total).toBe(0);
    expect(await store.getArtifact(created.id)).toBeNull();
  });

  it("validates manifest through store facade", async () => {
    const repo = await createTempRepo();
    const store = new ReferencesStore(repo.repoRoot);
    const result = await store.validateManifest();
    expect(result.ok).toBe(true);
  });
});
