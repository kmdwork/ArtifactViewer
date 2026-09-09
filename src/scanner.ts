import { BaseDirectory, readDir, readTextFile, watch, type DirEntry, type UnwatchFn } from "@tauri-apps/plugin-fs";
import { parseArtifact } from "./metadata";
import type { Artifact, ScanResult } from "./model";

export const ARTIFACT_DIRECTORY = "ai-artifacts";

function appendPath(parent: string, name: string): string {
  return `${parent}/${name}`;
}

function resolveArtifactResource(artifactPath: string, reference: string): string | undefined {
  if (!reference || reference.startsWith("#") || reference.startsWith("/") || reference.includes("\\")) return undefined;
  if (/^[a-z][a-z\d+.-]*:/i.test(reference) || reference.startsWith("//")) return undefined;

  let decoded: string;
  try {
    decoded = decodeURIComponent(reference.split(/[?#]/, 1)[0]);
  } catch {
    return undefined;
  }

  const parts = artifactPath.split("/").slice(0, -1);
  for (const part of decoded.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (parts.length <= 1) return undefined;
      parts.pop();
    } else {
      parts.push(part);
    }
  }

  const resolved = parts.join("/");
  return resolved === ARTIFACT_DIRECTORY || resolved.startsWith(`${ARTIFACT_DIRECTORY}/`) ? resolved : undefined;
}

async function preparePreviewHtml(artifactPath: string, html: string): Promise<string> {
  const document = new DOMParser().parseFromString(html, "text/html");

  for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"][href]')) {
    const resourcePath = resolveArtifactResource(artifactPath, link.getAttribute("href") ?? "");
    if (!resourcePath?.toLowerCase().endsWith(".css")) continue;
    try {
      const style = document.createElement("style");
      style.dataset.artifactSource = resourcePath;
      style.textContent = await readTextFile(resourcePath, { baseDir: BaseDirectory.Home });
      link.replaceWith(style);
    } catch {
      // Keep the original link so the document remains valid when opened directly.
    }
  }

  for (const script of document.querySelectorAll<HTMLScriptElement>("script[src]")) {
    const resourcePath = resolveArtifactResource(artifactPath, script.getAttribute("src") ?? "");
    if (!resourcePath?.toLowerCase().endsWith(".js")) continue;
    try {
      const inlineScript = document.createElement("script");
      inlineScript.dataset.artifactSource = resourcePath;
      inlineScript.textContent = await readTextFile(resourcePath, { baseDir: BaseDirectory.Home });
      script.replaceWith(inlineScript);
    } catch {
      // Keep the original script so the document remains valid when opened directly.
    }
  }

  return `<!doctype html>\n${document.documentElement.outerHTML}`;
}

async function collectHtmlFiles(directory: string): Promise<string[]> {
  const entries: DirEntry[] = await readDir(directory, { baseDir: BaseDirectory.Home });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isSymlink) continue;
    const path = appendPath(directory, entry.name);
    if (entry.isDirectory) {
      files.push(...(await collectHtmlFiles(path)));
    } else if (entry.isFile && /\.html?$/i.test(entry.name)) {
      files.push(path);
    }
  }

  return files;
}

export async function scanArtifacts(): Promise<ScanResult> {
  let paths: string[];
  try {
    paths = await collectHtmlFiles(ARTIFACT_DIRECTORY);
  } catch {
    return { artifacts: [], failedFiles: 0, directoryMissing: true };
  }

  let failedFiles = 0;
  const parsed = await Promise.all(
    paths.map(async (path): Promise<Artifact | null> => {
      try {
        const html = await readTextFile(path, { baseDir: BaseDirectory.Home });
        const fileName = path.split("/").at(-1) ?? path;
        const artifact = parseArtifact(path, fileName, html);
        artifact.html = await preparePreviewHtml(path, html);
        return artifact;
      } catch {
        failedFiles += 1;
        return null;
      }
    }),
  );

  const artifacts = parsed
    .filter((artifact): artifact is Artifact => artifact !== null)
    .sort((left, right) => {
      const leftTime = Date.parse(left.createdAt) || 0;
      const rightTime = Date.parse(right.createdAt) || 0;
      return rightTime - leftTime || left.title.localeCompare(right.title);
    });

  return { artifacts, failedFiles, directoryMissing: false };
}

export async function watchArtifacts(onChange: () => void): Promise<UnwatchFn | undefined> {
  try {
    return await watch(ARTIFACT_DIRECTORY, onChange, {
      baseDir: BaseDirectory.Home,
      recursive: true,
      delayMs: 500,
    });
  } catch {
    return undefined;
  }
}
