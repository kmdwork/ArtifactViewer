import "./style.css";
import type { Artifact, Filters, ScanResult } from "./model";
import { scanArtifacts, watchArtifacts } from "./scanner";
import { DEFAULT_TYPES, filterArtifacts, projectNames } from "./search";
import { setPreview } from "./viewer";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("App root was not found.");

root.innerHTML = `
  <main class="app-shell">
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">A</span>
        <div><h1>Artifact Viewer</h1><p>~/ai-artifacts/</p></div>
      </div>
      <label class="search"><span aria-hidden="true">⌕</span><input id="search" type="search" placeholder="Search artifacts" autocomplete="off" /></label>
      <button class="refresh" id="refresh" type="button">Refresh</button>
    </header>
    <div class="workspace">
      <aside class="sidebar" aria-label="Artifact filters">
        <section><h2>Type</h2><nav id="type-filters" class="filter-list"></nav></section>
        <section><h2>Project</h2><nav id="project-filters" class="filter-list"></nav></section>
        <footer><span id="scan-state">Loading…</span></footer>
      </aside>
      <section class="artifact-panel">
        <div class="panel-heading"><div><p class="eyebrow">Library</p><h2 id="list-title">All artifacts</h2></div><span id="result-count"></span></div>
        <div id="notice" class="notice" hidden></div>
        <div id="artifact-list" class="artifact-list"></div>
      </section>
      <section class="preview-panel">
        <div id="preview-empty" class="preview-empty"><span aria-hidden="true">◇</span><h2>Select an artifact</h2><p>The HTML preview will appear here.</p></div>
        <iframe id="preview" sandbox="allow-scripts" referrerpolicy="no-referrer" title="Artifact preview" hidden></iframe>
      </section>
    </div>
  </main>`;

const element = <T extends Element>(selector: string): T => {
  const match = document.querySelector<T>(selector);
  if (!match) throw new Error(`Missing element: ${selector}`);
  return match;
};

const searchInput = element<HTMLInputElement>("#search");
const typeFilters = element<HTMLElement>("#type-filters");
const projectFilters = element<HTMLElement>("#project-filters");
const artifactList = element<HTMLElement>("#artifact-list");
const resultCount = element<HTMLElement>("#result-count");
const listTitle = element<HTMLElement>("#list-title");
const notice = element<HTMLElement>("#notice");
const scanState = element<HTMLElement>("#scan-state");
const refreshButton = element<HTMLButtonElement>("#refresh");
const preview = element<HTMLIFrameElement>("#preview");
const previewEmpty = element<HTMLElement>("#preview-empty");

let allArtifacts: Artifact[] = [];
let selectedPath = "";
let scanInProgress = false;
let scanQueued = false;
const filters: Filters = { query: "", type: "", project: "" };

function escapeHtml(value: string): string {
  const node = document.createElement("span");
  node.textContent = value;
  return node.innerHTML;
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatDate(value: string): string {
  if (!value) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function filterButton(label: string, value: string, active: boolean, count?: number): string {
  return `<button type="button" data-filter="${escapeAttribute(value)}" class="filter-button${active ? " active" : ""}"><span>${escapeHtml(label)}</span>${count === undefined ? "" : `<small>${count}</small>`}</button>`;
}

function renderFilters(): void {
  typeFilters.innerHTML = [
    filterButton("All", "", filters.type === "", allArtifacts.length),
    ...DEFAULT_TYPES.map((type) =>
      filterButton(type[0].toUpperCase() + type.slice(1), type, filters.type === type, allArtifacts.filter((item) => item.type === type).length),
    ),
  ].join("");

  const projects = projectNames(allArtifacts);
  projectFilters.innerHTML = [
    filterButton("All projects", "", filters.project === ""),
    ...projects.map((project) => filterButton(project, project, filters.project === project)),
  ].join("");
}

function selectArtifact(artifact?: Artifact): void {
  selectedPath = artifact?.path ?? "";
  setPreview(preview, artifact);
  previewEmpty.hidden = Boolean(artifact);
  for (const card of artifactList.querySelectorAll<HTMLElement>("[data-path]")) {
    card.classList.toggle("selected", card.dataset.path === selectedPath);
  }
}

function renderList(): void {
  const artifacts = filterArtifacts(allArtifacts, filters);
  resultCount.textContent = `${artifacts.length} ${artifacts.length === 1 ? "artifact" : "artifacts"}`;
  listTitle.textContent = filters.type ? `${filters.type[0].toUpperCase()}${filters.type.slice(1)}` : filters.project || "All artifacts";

  if (!artifacts.length) {
    artifactList.innerHTML = `<div class="empty-list"><h3>No artifacts found</h3><p>Try another search or filter.</p></div>`;
    selectArtifact();
    return;
  }

  artifactList.innerHTML = artifacts
    .map((artifact) => {
      const tags = artifact.tags.slice(0, 3).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
      const riskClass = artifact.risk?.replace(/[^a-z0-9_-]/gi, "") ?? "";
      const risk = artifact.risk ? `<span class="risk risk-${riskClass}">${escapeHtml(artifact.risk)}</span>` : "";
      return `<button class="artifact-card${selectedPath === artifact.path ? " selected" : ""}" type="button" data-path="${escapeAttribute(artifact.path)}">
        <span class="card-top"><span class="type">${escapeHtml(artifact.type)}</span>${risk}</span>
        <strong>${escapeHtml(artifact.title)}</strong>
        <span class="project">${escapeHtml(artifact.project)}</span>
        <span class="card-meta"><time>${escapeHtml(formatDate(artifact.createdAt))}</time>${artifact.git?.commit ? `<code>${escapeHtml(artifact.git.commit.slice(0, 8))}</code>` : ""}</span>
        ${tags ? `<span class="tags">${tags}</span>` : ""}
        ${artifact.warnings.length ? `<span class="metadata-warning" title="${escapeAttribute(artifact.warnings.join(" "))}">Metadata warning</span>` : ""}
      </button>`;
    })
    .join("");

  const stillVisible = artifacts.find((artifact) => artifact.path === selectedPath);
  selectArtifact(stillVisible ?? artifacts[0]);
}

function render(result: ScanResult): void {
  allArtifacts = result.artifacts;
  renderFilters();
  renderList();
  scanState.textContent = result.directoryMissing ? "Directory not found" : "Watching for changes";
  notice.hidden = !result.directoryMissing && result.failedFiles === 0;
  notice.textContent = result.directoryMissing
    ? "Create ~/ai-artifacts/ and add an HTML artifact to get started."
    : result.failedFiles
      ? `${result.failedFiles} file(s) could not be read.`
      : "";
}

async function refresh(): Promise<void> {
  if (scanInProgress) {
    scanQueued = true;
    return;
  }
  scanInProgress = true;
  refreshButton.disabled = true;
  scanState.textContent = "Scanning…";
  try {
    render(await scanArtifacts());
  } finally {
    scanInProgress = false;
    refreshButton.disabled = false;
    if (scanQueued) {
      scanQueued = false;
      void refresh();
    }
  }
}

typeFilters.addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>("[data-filter]");
  if (!button) return;
  filters.type = button.dataset.filter ?? "";
  renderFilters();
  renderList();
});

projectFilters.addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>("[data-filter]");
  if (!button) return;
  filters.project = button.dataset.filter ?? "";
  renderFilters();
  renderList();
});

artifactList.addEventListener("click", (event) => {
  const card = (event.target as Element).closest<HTMLElement>("[data-path]");
  selectArtifact(allArtifacts.find((artifact) => artifact.path === card?.dataset.path));
});

searchInput.addEventListener("input", () => {
  filters.query = searchInput.value;
  renderList();
});
refreshButton.addEventListener("click", () => void refresh());

void (async () => {
  await refresh();
  const unwatch = await watchArtifacts(() => void refresh());
  if (!unwatch) scanState.textContent = "Manual refresh only";
  window.addEventListener("beforeunload", () => unwatch?.(), { once: true });
})();
