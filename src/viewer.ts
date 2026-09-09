import type { Artifact } from "./model";

export function setPreview(iframe: HTMLIFrameElement, artifact?: Artifact): void {
  if (!artifact) {
    iframe.removeAttribute("srcdoc");
    iframe.hidden = true;
    return;
  }

  iframe.srcdoc = artifact.html;
  iframe.title = `${artifact.title} preview`;
  iframe.hidden = false;
}
