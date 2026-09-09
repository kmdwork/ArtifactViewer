import type { Artifact, GitMetadata } from "./model";

type StructuredMetadata = {
  version?: unknown;
  tags?: unknown;
  risk?: unknown;
  git?: unknown;
};

const textValue = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

function parseGit(value: unknown): GitMetadata | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  const record = value as Record<string, unknown>;
  const git: GitMetadata = {
    repository: textValue(record.repository),
    branch: textValue(record.branch),
    commit: textValue(record.commit),
    baseCommit: textValue(record.baseCommit),
  };

  return Object.values(git).some(Boolean) ? git : undefined;
}

function fallbackTitle(fileName: string): string {
  return fileName
    .replace(/\.html?$/i, "")
    .replace(/^\d{8}-/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function validDate(value: string | undefined): string | undefined {
  if (!value || Number.isNaN(Date.parse(value))) return undefined;
  return value;
}

export function parseArtifact(path: string, fileName: string, html: string): Artifact {
  const document = new DOMParser().parseFromString(html, "text/html");
  const warnings: string[] = [];
  const meta = (name: string): string | undefined =>
    textValue(document.querySelector(`meta[name="${name}"]`)?.getAttribute("content"));

  let structured: StructuredMetadata = {};
  const metadataNode = document.querySelector<HTMLScriptElement>("#artifact-metadata");
  if (metadataNode?.textContent?.trim()) {
    try {
      const parsed: unknown = JSON.parse(metadataNode.textContent);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        structured = parsed as StructuredMetadata;
      } else {
        warnings.push("Structured metadata is not an object.");
      }
    } catch {
      warnings.push("Structured metadata JSON could not be parsed.");
    }
  }

  const rawTitle = meta("artifact:title");
  const rawType = meta("artifact:type");
  const rawProject = meta("artifact:project");
  const rawCreatedAt = meta("artifact:created-at");

  if (!rawTitle) warnings.push("artifact:title is missing.");
  if (!rawType) warnings.push("artifact:type is missing.");
  if (!rawProject) warnings.push("artifact:project is missing.");
  if (!validDate(rawCreatedAt)) warnings.push("artifact:created-at is missing or invalid.");

  return {
    path,
    fileName,
    title: rawTitle ?? fallbackTitle(fileName),
    type: rawType?.toLowerCase() ?? "unknown",
    project: rawProject ?? "Uncategorized",
    createdAt: validDate(rawCreatedAt) ?? "",
    tags: Array.isArray(structured.tags)
      ? structured.tags.map(textValue).filter((tag): tag is string => Boolean(tag))
      : [],
    risk: textValue(structured.risk)?.toLowerCase(),
    git: parseGit(structured.git),
    html,
    warnings,
  };
}
