import { promises as fs } from "node:fs";

import type { Artifact } from "./types.js";

export interface SuggestedReference {
  filename: string;
  reason: string;
}

export interface ArtifactSummary {
  themes: string[];
  open_questions: string[];
  candidate_changes: string[];
  suggested_reffy_references: SuggestedReference[];
}

interface StoreReader {
  listArtifacts(): Promise<Artifact[]>;
  getArtifactPath(artifact: Artifact): string;
}

const GENERIC_HEADINGS = new Set([
  "problem",
  "proposed feature",
  "scope",
  "scope (small)",
  "why it fits reffy",
  "ux sketch",
  "acceptance criteria",
  "follow-up",
  "follow-up (optional)",
]);

function normalizeLine(line: string): string {
  return line.replace(/`/g, "").replace(/\s+/g, " ").trim();
}

function pushUnique(list: string[], value: string): void {
  const next = normalizeLine(value);
  if (next.length === 0) return;
  if (!list.includes(next)) list.push(next);
}

function isLikelyNaturalLanguageQuestion(line: string): boolean {
  if (!line.includes("?")) return false;
  if (/[{}\[\]]/.test(line)) return false;
  if (/["']\s*:/.test(line)) return false;
  return true;
}

function headingValue(line: string): string | null {
  const match = line.match(/^#{1,6}\s+(.+)$/);
  if (!match) return null;
  return normalizeLine(match[1] ?? "");
}

function summarizeArtifactContent(
  artifact: Artifact,
  content: string,
  themeOut: string[],
  questionsOut: string[],
  changesOut: string[],
): string {
  let currentSection = "";
  let hasQuestion = false;
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) continue;

    const heading = headingValue(line);
    if (heading) {
      currentSection = heading.toLowerCase();
      const generic = GENERIC_HEADINGS.has(currentSection);
      if (!generic) {
        const cleaned = heading.replace(/^feature idea:\s*/i, "");
        pushUnique(themeOut, cleaned);
      }
      continue;
    }

    if (isLikelyNaturalLanguageQuestion(line)) {
      hasQuestion = true;
      pushUnique(questionsOut, line.replace(/^[*-]\s*/, ""));
    }

    const commandMatches = line.match(/`(reffy [^`]+)`/g) ?? [];
    for (const cmd of commandMatches) {
      const cleanCmd = cmd.replace(/`/g, "");
      pushUnique(changesOut, `Introduce ${cleanCmd}`);
    }

    if (currentSection.includes("proposed feature") && line.startsWith("- ") && !line.includes("`reffy ")) {
      pushUnique(changesOut, line.replace(/^-+\s*/, ""));
    }
  }

  if (themeOut.length === 0) {
    pushUnique(themeOut, artifact.name);
  }

  if (content.toLowerCase().includes("feature idea")) {
    return "feature ideation and rationale";
  }
  if (hasQuestion) {
    return "open questions and constraints";
  }
  return "exploratory context note";
}

export async function summarizeArtifacts(store: StoreReader): Promise<ArtifactSummary> {
  const artifacts = await store.listArtifacts();
  const themes: string[] = [];
  const openQuestions: string[] = [];
  const candidateChanges: string[] = [];
  const references: SuggestedReference[] = [];

  for (const artifact of artifacts) {
    const path = store.getArtifactPath(artifact);
    let content = "";
    try {
      content = await fs.readFile(path, "utf8");
    } catch {
      continue;
    }

    const reason = summarizeArtifactContent(artifact, content, themes, openQuestions, candidateChanges);
    references.push({
      filename: artifact.filename,
      reason,
    });
  }

  return {
    themes: themes.slice(0, 8),
    open_questions: openQuestions.slice(0, 8),
    candidate_changes: candidateChanges.slice(0, 8),
    suggested_reffy_references: references,
  };
}
