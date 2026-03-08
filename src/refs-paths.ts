import { existsSync, statSync } from "node:fs";
import path from "node:path";

export const DEFAULT_REFS_DIRNAME = ".reffy";
export const LEGACY_REFS_DIRNAME = ".references";

function isDirectory(targetPath: string): boolean {
  try {
    return statSync(targetPath).isDirectory();
  } catch {
    return false;
  }
}

export function resolveRefsDirName(repoRoot: string): string {
  const reffyDir = path.join(repoRoot, DEFAULT_REFS_DIRNAME);
  if (isDirectory(reffyDir)) {
    return DEFAULT_REFS_DIRNAME;
  }

  const legacyDir = path.join(repoRoot, LEGACY_REFS_DIRNAME);
  if (isDirectory(legacyDir)) {
    return LEGACY_REFS_DIRNAME;
  }

  return DEFAULT_REFS_DIRNAME;
}

export function resolveRefsDir(repoRoot: string): string {
  return path.join(repoRoot, resolveRefsDirName(repoRoot));
}

export function looksLikeRefsDir(targetPath: string): boolean {
  const base = path.basename(targetPath);
  return (
    (base === DEFAULT_REFS_DIRNAME || base === LEGACY_REFS_DIRNAME) &&
    existsSync(path.join(targetPath, "artifacts")) &&
    isDirectory(path.join(targetPath, "artifacts"))
  );
}
