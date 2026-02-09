import { promises as fs } from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import Fastify from "fastify";

import { LinearClient, LinearSync } from "./linear.js";
import { ReferencesStore } from "./storage.js";
import { ReferencesWatcher } from "./watcher.js";

const repoRoot = process.cwd();
dotenv.config({ path: path.join(repoRoot, ".env") });

const REFFY_ASCII = String.raw`
 _ __ ___  / _|/ _|_   _
| '__/ _ \| |_| |_| | | |
| | |  __/|  _|  _| |_| |
|_|  \___||_| |_|  \__, |
                   |___/
`;

const store = new ReferencesStore(repoRoot);
const linear = LinearClient.fromEnv();
const linearSync = new LinearSync(repoRoot, store, linear);

let watcher: ReferencesWatcher | null = null;

function isArrayOfStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function startLoadingIndicator(label: string): (finalMessage: string) => void {
  if (!process.stdout.isTTY) {
    console.log(`${label}...`);
    return (finalMessage: string) => console.log(finalMessage);
  }

  let frame = 0;
  process.stdout.write(`${label}`);
  const timer = setInterval(() => {
    frame = (frame + 1) % 4;
    const dots = ".".repeat(frame).padEnd(3, " ");
    process.stdout.write(`\r${label}${dots}`);
  }, 300);

  return (finalMessage: string) => {
    clearInterval(timer);
    process.stdout.write(`\r${finalMessage}\n`);
  };
}

async function watcherCallback(paths: Set<string>): Promise<void> {
  const artifactsPath = path.join(store.refsDir, "artifacts");
  const artifactsChanged = Array.from(paths).some((filePath) => filePath.includes(artifactsPath));

  if (process.env.LINEAR_WATCH_REINDEX === "1" && artifactsChanged) {
    try {
      await store.reindexArtifacts();
    } catch {
      // no-op
    }
  }

  if (process.env.LINEAR_WATCH_PUSH === "1" && artifactsChanged) {
    try {
      await linearSync.push();
    } catch {
      // no-op
    }
  }
}

async function start(): Promise<void> {
  console.log(REFFY_ASCII);
  const stopLoadingIndicator = startLoadingIndicator("loading server");
  const app = Fastify({ logger: false });

  try {
    app.get("/health", async () => ({ status: "ok" }));

    app.get("/references", async (request) => {
      const query = request.query as { kind?: string; tag?: string };
      let items = await store.listArtifacts();
      if (query.kind) items = items.filter((item) => item.kind === query.kind);
      if (query.tag) {
        const tag = query.tag;
        items = items.filter((item) => item.tags.includes(tag));
      }
      return { items };
    });

    app.post("/references", async (request, reply) => {
      const payload = (request.body ?? {}) as Record<string, unknown>;
      const tags = payload.tags;
      if (tags !== undefined && !isArrayOfStrings(tags)) {
        return reply.code(400).send({ error: "tags_must_be_list" });
      }

      const artifact = await store.createArtifact({
        name: String(payload.name ?? "untitled"),
        content: typeof payload.content === "string" ? payload.content : null,
        kind: typeof payload.kind === "string" ? payload.kind : null,
        mime_type: typeof payload.mime_type === "string" ? payload.mime_type : null,
        tags: tags ?? null,
      });

      return reply.code(201).send(artifact);
    });

    app.post("/references/reindex", async () => store.reindexArtifacts());

    app.get("/references/:artifactId", async (request, reply) => {
      const params = request.params as { artifactId: string };
      const artifact = await store.getArtifact(params.artifactId);
      if (!artifact) {
        return reply.code(404).send({ error: "not_found" });
      }
      return artifact;
    });

    app.patch("/references/:artifactId", async (request, reply) => {
      const params = request.params as { artifactId: string };
      const payload = (request.body ?? {}) as Record<string, unknown>;
      const tags = payload.tags;

      if (tags !== undefined && !isArrayOfStrings(tags)) {
        return reply.code(400).send({ error: "tags_must_be_list" });
      }

      const updated = await store.updateArtifact(params.artifactId, {
        name: typeof payload.name === "string" ? payload.name : null,
        content: typeof payload.content === "string" ? payload.content : null,
        kind: typeof payload.kind === "string" ? payload.kind : null,
        mime_type: typeof payload.mime_type === "string" ? payload.mime_type : null,
        tags: tags ?? null,
      });

      if (!updated) {
        return reply.code(404).send({ error: "not_found" });
      }

      return updated;
    });

    app.delete("/references/:artifactId", async (request, reply) => {
      const params = request.params as { artifactId: string };
      const deleted = await store.deleteArtifact(params.artifactId);
      if (!deleted) {
        return reply.code(404).send({ error: "not_found" });
      }
      return reply.code(204).send();
    });

    app.get("/references/:artifactId/download", async (request, reply) => {
      const params = request.params as { artifactId: string };
      const artifact = await store.getArtifact(params.artifactId);
      if (!artifact) {
        return reply.code(404).send({ error: "not_found" });
      }

      const artifactPath = store.getArtifactPath(artifact);
      const content = await fs.readFile(artifactPath).catch(() => null);
      if (!content) {
        return reply.code(404).send({ error: "missing_file" });
      }

      reply.type(artifact.mime_type || "application/octet-stream");
      return reply.send(content);
    });

    app.post("/sync/push", async (request, reply) => {
      const response = await linearSync.push();
      response.configured = linear.isConfigured();
      return reply.code(response.status === "error" ? 400 : 200).send(response);
    });

    app.post("/sync/pull", async (request, reply) => {
      const response = await linearSync.pull();
      response.configured = linear.isConfigured();
      return reply.code(response.status === "error" ? 400 : 200).send(response);
    });

    app.setErrorHandler((error, _request, reply) => {
      reply.code(500).send({ error: "internal_error", detail: String(error) });
    });

    if (process.env.LINEAR_PULL_ON_START === "1") {
      try {
        const startupPull = await linearSync.pull();
        console.log(
          `Startup pull complete: updated=${String(startupPull.updated ?? 0)} created=${String(
            startupPull.created_issue_identifiers ? (startupPull.created_issue_identifiers as unknown[]).length : 0,
          )} reconciled=${String(startupPull.reconciled ?? 0)} errors=${String(
            startupPull.errors ? (startupPull.errors as unknown[]).length : 0,
          )}`,
        );
      } catch (error) {
        console.error(`Startup pull failed: ${String(error)}`);
      }
    }

    if (ReferencesWatcher.enabled()) {
      watcher = new ReferencesWatcher(store.refsDir, (paths) => {
        void watcherCallback(paths);
      });
      watcher.start();
    }

    const port = Number(process.env.PORT ?? "8787");
    const host = process.env.HOST ?? "127.0.0.1";

    const shutdown = (): void => {
      void (async () => {
        if (watcher) {
          await watcher.stop();
          watcher = null;
        }
        await app.close();
        process.exit(0);
      })();
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    await app.listen({ port, host });
    stopLoadingIndicator("loading server... done");
    console.log(`Reffy TS listening on http://${host}:${port}`);
  } catch (error) {
    stopLoadingIndicator("loading server... failed");
    throw error;
  }
}

void start().catch((error) => {
  console.error(String(error));
  process.exit(1);
});
