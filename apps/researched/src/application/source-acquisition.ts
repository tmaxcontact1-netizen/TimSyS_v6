import { lookup } from "node:dns/promises";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { isIP } from "node:net";
import { dirname, join } from "node:path";
import { contentHash } from "@timsys/app-sdk";
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

export interface AcquiredSource {
  readonly requestedUrl: string;
  readonly resolvedUrl: string;
  readonly status: number;
  readonly mediaType: string;
  readonly bytes: Buffer;
  readonly hash: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}
const privateV4 = (address: string) => {
  const p = address.split(".").map(Number);
  return (
    p[0] === 10 ||
    p[0] === 127 ||
    p[0] === 0 ||
    (p[0] === 169 && p[1] === 254) ||
    (p[0] === 172 && (p[1] ?? 0) >= 16 && (p[1] ?? 0) <= 31) ||
    (p[0] === 192 && p[1] === 168) ||
    (p[0] === 100 && (p[1] ?? 0) >= 64 && (p[1] ?? 0) <= 127)
  );
};
const privateV6 = (address: string) => {
  const a = address.toLowerCase();
  return (
    a === "::1" ||
    a === "::" ||
    a.startsWith("fc") ||
    a.startsWith("fd") ||
    a.startsWith("fe8") ||
    a.startsWith("fe9") ||
    a.startsWith("fea") ||
    a.startsWith("feb") ||
    a.startsWith("::ffff:127.") ||
    a.startsWith("::ffff:10.") ||
    a.startsWith("::ffff:192.168.")
  );
};
export async function assertPublicUrl(
  value: string,
  resolver = lookup,
): Promise<URL> {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !["80", "443"].includes(url.port))
  )
    throw new Error("source_url_not_allowed");
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  )
    throw new Error("source_host_not_public");
  const addresses = isIP(host)
    ? [{ address: host }]
    : await resolver(host, { all: true, verbatim: true });
  if (
    !addresses.length ||
    addresses.some(({ address }) =>
      isIP(address) === 4 ? privateV4(address) : privateV6(address),
    )
  )
    throw new Error("source_host_not_public");
  return url;
}
async function limitedBytes(response: Response, maximum: number) {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > maximum) throw new Error("source_too_large");
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.byteLength;
      if (size > maximum) throw new Error("source_too_large");
      chunks.push(item.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(
    chunks.map((v) => Buffer.from(v)),
    size,
  );
}
export async function acquireSource(
  requestedUrl: string,
  options: {
    fetcher?: typeof fetch;
    resolver?: typeof lookup;
    maximumBytes?: number;
    timeoutMs?: number;
  } = {},
): Promise<AcquiredSource> {
  const fetcher = options.fetcher ?? fetch;
  let current = await assertPublicUrl(requestedUrl, options.resolver ?? lookup);
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);
  try {
    for (let redirects = 0; redirects <= 5; redirects++) {
      const response = await fetcher(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept:
            "text/html,application/pdf,text/plain,application/xhtml+xml,application/octet-stream;q=0.5",
          "User-Agent": "ResearchEd/0.1 source-preservation",
        },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new Error("redirect_without_location");
        current = await assertPublicUrl(
          new URL(location, current).href,
          options.resolver ?? lookup,
        );
        continue;
      }
      if (!response.ok)
        throw Object.assign(new Error("source_http_error"), {
          status: response.status,
        });
      const bytes = await limitedBytes(
          response,
          options.maximumBytes ?? 25_000_000,
        ),
        mediaType = (
          response.headers.get("content-type") ?? "application/octet-stream"
        )
          .split(";")[0]!
          .trim()
          .toLowerCase();
      return Object.freeze({
        requestedUrl,
        resolvedUrl: current.href,
        status: response.status,
        mediaType,
        bytes,
        hash: contentHash(bytes),
        metadata: Object.freeze({
          etag: response.headers.get("etag"),
          lastModified: response.headers.get("last-modified"),
          contentLanguage: response.headers.get("content-language"),
        }),
      });
    }
    throw new Error("too_many_redirects");
  } finally {
    clearTimeout(timer);
  }
}
export async function preserveSource(
  root: string,
  sourceId: string,
  snapshotId: string,
  bytes: Buffer,
  mediaType: string,
) {
  const extension =
      mediaType === "application/pdf"
        ? ".pdf"
        : mediaType.includes("html")
          ? ".html"
          : mediaType.startsWith("text/")
            ? ".txt"
            : ".bin",
    relative = join("sources", sourceId, `${snapshotId}${extension}`),
    target = join(root, relative),
    temporary = `${target}.partial`;
  await mkdir(dirname(target), { recursive: true });
  try {
    await writeFile(temporary, bytes, { flag: "wx" });
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  return relative.replaceAll("\\", "/");
}

export function findBrowserExecutable(configured?: string) {
  const candidates = [
    configured,
    process.env.RESEARCHED_BROWSER_EXECUTABLE,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ].filter((value): value is string => Boolean(value));
  return candidates.find(existsSync) ?? null;
}
export async function acquireRenderedSource(
  requestedUrl: string,
  options: {
    executablePath?: string;
    maximumBytes?: number;
    timeoutMs?: number;
    expandInteractiveContent?: boolean;
    maximumInteractions?: number;
  } = {},
): Promise<AcquiredSource> {
  const initial = await assertPublicUrl(requestedUrl),
    executablePath = findBrowserExecutable(options.executablePath);
  if (!executablePath) throw new Error("browser_renderer_unavailable");
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: [
      "--disable-extensions",
      "--disable-background-networking",
      "--no-first-run",
    ],
  });
  try {
    const context = await browser.newContext({
        javaScriptEnabled: true,
        serviceWorkers: "block",
      }),
      page = await context.newPage();
    await page.route("**/*", async (route) => {
      try {
        await assertPublicUrl(route.request().url());
        await route.continue();
      } catch {
        await route.abort("blockedbyclient");
      }
    });
    const response = await page.goto(initial.href, {
      waitUntil: "networkidle",
      timeout: options.timeoutMs ?? 45_000,
    });
    if (!response) throw new Error("rendered_source_no_response");
    if (!response.ok()) throw new Error("source_http_error");
    const interactions: {kind:string;label:string}[]=[];
    if(options.expandInteractiveContent !== false){
      const details=page.locator("details:not([open])");
      for(let index=0;index<Math.min(await details.count(),options.maximumInteractions??40);index++){
        const item=details.nth(index); await item.evaluate((element)=>(element as HTMLDetailsElement).open=true);
        interactions.push({kind:"details",label:(await item.locator("summary").textContent().catch(()=>null))?.trim().slice(0,160)||"Expandable section"});
      }
      const remaining=Math.max(0,(options.maximumInteractions??40)-interactions.length);
      const controls=page.locator('[aria-expanded="false"], button').filter({hasText:/\b(read|show|view|load)\s+more\b|\bexpand\b/i});
      for(let index=0;index<Math.min(await controls.count(),remaining);index++){
        const control=controls.nth(index);
        if(!(await control.isVisible().catch(()=>false))) continue;
        const label=((await control.textContent().catch(()=>null))??(await control.getAttribute("aria-label"))??"Expandable control").trim().slice(0,160);
        try{await control.click({timeout:2_500}); interactions.push({kind:"click",label}); await page.waitForTimeout(100);}catch{/* A stale or covered control remains visible in the audit only by its absence. */}
      }
    }
    const html = await page.content(),
      bytes = Buffer.from(html, "utf8"),
      maximum = options.maximumBytes ?? 25_000_000;
    if (bytes.length > maximum) throw new Error("source_too_large");
    const resolvedUrl = page.url();
    await assertPublicUrl(resolvedUrl);
    return Object.freeze({
      requestedUrl,
      resolvedUrl,
      status: response.status(),
      mediaType: "text/html",
      bytes,
      hash: contentHash(bytes),
      metadata: Object.freeze({
        rendered: true,
        browser: "system-chromium",
        title: await page.title(),
        interactions,
        interactionCount:interactions.length,
      }),
    });
  } finally {
    await browser.close();
  }
}
