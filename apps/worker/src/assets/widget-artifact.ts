import {
  createBuildManifest,
  type BuildManifest,
} from "../../../../packages/contracts/src/index";

export interface WidgetArtifact {
  readonly html: string;
  readonly manifest: BuildManifest;
}

export async function loadWidgetArtifact(env: Env, requestUrl: string): Promise<WidgetArtifact> {
  const assetUrl = new URL("/index.html", requestUrl);
  const response = await env.ASSETS.fetch(new Request(assetUrl));
  if (!response.ok) throw new Error(`Widget asset returned ${response.status}.`);
  const html = await response.text();
  return {
    html,
    manifest: createBuildManifest(await sha256Hex(new TextEncoder().encode(html))),
  };
}

export async function sha256Hex(bytes: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}
