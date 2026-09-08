import { load } from "cheerio";
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
export interface DiscoveredLink {
  readonly url: string;
  readonly text: string | null;
}
export function discoverLinks(
  html: string,
  baseUrl: string,
  options: { sameOrigin?: boolean; maximum?: number } = {},
): readonly DiscoveredLink[] {
  const base = new URL(baseUrl),
    sameOrigin = options.sameOrigin ?? true,
    maximum = Math.min(200, Math.max(1, options.maximum ?? 100)),
    document = load(html),
    found = new Map<string, DiscoveredLink>();
  document("a[href]").each((_index, element) => {
    if (found.size >= maximum) return;
    const href = document(element).attr("href")?.trim();
    if (!href || href.startsWith("#")) return;
    let target: URL;
    try {
      target = new URL(href, base);
    } catch {
      return;
    }
    if (!["http:", "https:"].includes(target.protocol)) return;
    if (sameOrigin && target.origin !== base.origin) return;
    target.hash = "";
    const key = target.href;
    if (key === base.href || found.has(key)) return;
    const text = document(element).text().replace(/\s+/g, " ").trim();
    found.set(key, Object.freeze({ url: key, text: text || null }));
  });
  return Object.freeze([...found.values()]);
}
export async function discoverStoredLinks(
  storageRoot: string,
  storagePath: string,
  mediaType: string,
  baseUrl: string,
  options: { sameOrigin?: boolean; maximum?: number } = {},
) {
  if (!mediaType.toLowerCase().includes("html"))
    throw new Error("link_discovery_requires_html");
  if (!storagePath || isAbsolute(storagePath))
    throw new Error("invalid_snapshot_path");
  const root = resolve(storageRoot),
    target = resolve(root, storagePath),
    route = relative(root, target);
  if (!route || route.startsWith("..") || isAbsolute(route))
    throw new Error("invalid_snapshot_path");
  return discoverLinks(await readFile(target, "utf8"), baseUrl, options);
}
