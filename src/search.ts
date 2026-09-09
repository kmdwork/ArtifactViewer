import type { Artifact, Filters } from "./model";

export const DEFAULT_TYPES = ["review", "architecture", "study", "research"] as const;

function includes(value: string | undefined, query: string): boolean {
  return value?.toLocaleLowerCase().includes(query) ?? false;
}

export function filterArtifacts(artifacts: Artifact[], filters: Filters): Artifact[] {
  const query = filters.query.trim().toLocaleLowerCase();

  return artifacts.filter((artifact) => {
    if (filters.type && artifact.type !== filters.type) return false;
    if (filters.project && artifact.project !== filters.project) return false;
    if (!query) return true;

    return [
      artifact.title,
      artifact.project,
      artifact.type,
      ...artifact.tags,
      artifact.git?.repository,
      artifact.git?.branch,
      artifact.git?.commit,
    ].some((value) => includes(value, query));
  });
}

export function projectNames(artifacts: Artifact[]): string[] {
  return [...new Set(artifacts.map((artifact) => artifact.project))].sort((a, b) => a.localeCompare(b));
}
