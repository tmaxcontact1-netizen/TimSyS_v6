import { createReadStream } from "node:fs";
import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, isAbsolute, join, normalize } from "node:path";
import { pathToFileURL } from "node:url";
import type { Pool } from "pg";
import { z, ZodError } from "zod";

import { categoryInputSchema, garmentInputSchema, garmentUpdateSchema } from "../domain/garment/garment.js";
import { calibrationProfileInputSchema, type ImageRole } from "../domain/garment/photography.js";
import { loadConfig } from "../infrastructure/config/load-config.js";
import { createDatabasePool } from "../infrastructure/database/pool.js";
import { WardrobeRepository } from "../infrastructure/database/wardrobe-repository.js";
import { PhotographyRepository } from "../infrastructure/database/photography-repository.js";
import { FingerprintRepository } from "../infrastructure/database/fingerprint-repository.js";
import { PrivateImageStore } from "../infrastructure/images/private-image-store.js";
import { validateOriginalImage } from "../infrastructure/images/image-validation.js";
import { combineFingerprint, measureImage, suggestFields } from "../infrastructure/images/visual-fingerprint-engine.js";
import { applicationRoot } from "../infrastructure/runtime/application-root.js";

const contentTypes: Readonly<Record<string, string>> = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
});

function secure(response: ServerResponse): void {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
}

function json(response: ServerResponse, status: number, value: unknown): void {
  secure(response);
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

async function body(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += value.length;
    if (size > 1_000_000) throw new Error("request_too_large");
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new Error("invalid_json"); }
}

async function binaryBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += value.length;
    if (size > 25_000_000) throw new Error("request_too_large"); chunks.push(value);
  }
  if (size === 0) throw new Error("empty_image");
  return Buffer.concat(chunks);
}

function staticFile(directory: string, pathname: string): string | null {
  const requested = pathname === "/" ? "index.html" : pathname.slice(1);
  if (requested.includes("\\") || requested.includes("\0")) return null;
  const relative = normalize(requested);
  if (relative === ".." || relative.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(relative)) return null;
  return join(directory, relative);
}

export function createDressedServer(input: {
  readonly database: Pick<Pool, "query" | "connect">;
  readonly publicDirectory: string;
  readonly storageRoot: string;
  readonly now?: () => Date;
}) {
  const now = input.now ?? (() => new Date());
  const wardrobe = new WardrobeRepository(input.database as Pool);
  const photography = new PhotographyRepository(input.database as Pool);
  const fingerprints = new FingerprintRepository(input.database as Pool);
  const images = new PrivateImageStore(input.storageRoot);
  return createServer(async (request: IncomingMessage, response: ServerResponse) => {
    const method = request.method ?? "GET";
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    if (pathname === "/api/health") {
      if (method !== "GET") return json(response, 405, { error: "method_not_allowed" });
      try {
        const result = await input.database.query<{ database: string; schema_ready: boolean; catalogue_ready: boolean; photography_ready: boolean; fingerprint_ready: boolean }>(
          `SELECT current_database() AS database,
             to_regclass('dressed.dressed_schema_migrations') IS NOT NULL AS schema_ready,
             to_regclass('dressed.garments') IS NOT NULL AS catalogue_ready,
             to_regclass('dressed.garment_images') IS NOT NULL AS photography_ready,
             to_regclass('dressed.visual_fingerprints') IS NOT NULL AS fingerprint_ready`,
        );
        const row = result.rows[0];
        if (row?.schema_ready !== true || row.catalogue_ready !== true || row.photography_ready !== true || row.fingerprint_ready !== true) return json(response, 503, { status: "degraded", application: "dressed", database: "schema_unavailable" });
        return json(response, 200, {
          status: "healthy",
          application: "dressed",
          version: "0.0.0",
          database: "ready",
          observedAt: now().toISOString(),
        });
      } catch {
        return json(response, 503, { status: "unavailable", application: "dressed", database: "unavailable" });
      }
    }
    if (pathname === "/api/application") {
      if (method !== "GET") return json(response, 405, { error: "method_not_allowed" });
      return json(response, 200, {
        id: "dressed",
        name: "Dress'Ed",
        phase: 4,
        operationalFeatures: ["wardrobe-catalogue", "configurable-categories", "garment-metadata", "two-photo-capture", "calibration-profiles", "image-quality-gate", "visual-fingerprint", "editable-field-suggestions"],
        message: "Deterministic image measurements and editable garment suggestions are operational. Styling scores are not built yet.",
      });
    }
    try {
      if (pathname === "/api/categories") {
        if (method === "GET") return json(response, 200, { items: await wardrobe.categories() });
        if (method === "POST") return json(response, 201, await wardrobe.createCategory(randomUUID(), categoryInputSchema.parse(await body(request)), now().toISOString()));
        return json(response, 405, { error: "method_not_allowed" });
      }
      if (pathname === "/api/calibration-profiles") {
        if (method === "GET") return json(response, 200, { items: await photography.profiles() });
        if (method === "POST") return json(response, 201, await photography.createProfile(randomUUID(), calibrationProfileInputSchema.parse(await body(request)), now().toISOString()));
        return json(response, 405, { error: "method_not_allowed" });
      }
      if (pathname === "/api/garments") {
        if (method === "GET") {
          const url = new URL(request.url ?? pathname, "http://127.0.0.1");
          const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 1), 50);
          const offset = Math.max(Number.parseInt(url.searchParams.get("offset") ?? "0", 10) || 0, 0);
          return json(response, 200, await wardrobe.list({ search: url.searchParams.get("search")?.trim() || undefined, categoryId: url.searchParams.get("categoryId") || undefined, status: url.searchParams.get("status") || undefined, limit, offset }));
        }
        if (method === "POST") return json(response, 201, await wardrobe.create(randomUUID(), garmentInputSchema.parse(await body(request)), now().toISOString()));
        return json(response, 405, { error: "method_not_allowed" });
      }
      const garmentMatch = /^\/api\/garments\/([0-9a-f-]{36})$/i.exec(pathname);
      if (garmentMatch !== null) {
        const id = garmentMatch[1]!;
        if (method === "GET") { const found = await wardrobe.get(id); return found === null ? json(response, 404, { error: "not_found" }) : json(response, 200, found); }
        if (method === "PUT") { const updated = await wardrobe.update(id, garmentUpdateSchema.parse(await body(request)), now().toISOString()); return updated === null ? json(response, 409, { error: "version_conflict_or_archived" }) : json(response, 200, updated); }
        if (method === "DELETE") {
          const parsed = await body(request);
          if (typeof parsed !== "object" || parsed === null || !("version" in parsed)) return json(response, 400, { error: "invalid_version" });
          if (!Number.isInteger(parsed.version) || Number(parsed.version) < 1) return json(response, 400, { error: "invalid_version" });
          return await wardrobe.archive(id, Number(parsed.version), now().toISOString()) ? json(response, 200, { archived: true }) : json(response, 409, { error: "version_conflict_or_archived" });
        }
        return json(response, 405, { error: "method_not_allowed" });
      }
      const garmentImagesMatch = /^\/api\/garments\/([0-9a-f-]{36})\/images$/i.exec(pathname);
      if (garmentImagesMatch !== null) {
        const garmentId = garmentImagesMatch[1]!;
        if (method === "GET") return json(response, 200, { items: await photography.images(garmentId), readiness: await photography.readiness(garmentId) });
        if (method === "POST") {
          if (!(await photography.garmentExists(garmentId))) return json(response, 404, { error: "garment_not_found" });
          const url = new URL(request.url ?? pathname, "http://127.0.0.1");
          const role = url.searchParams.get("role"); const profileId = url.searchParams.get("calibrationProfileId"); const filename = (url.searchParams.get("filename") ?? "original").replace(/[\\/\0]/g, "_").slice(0, 240);
          if (!(["whole","detail","additional"] as readonly string[]).includes(role ?? "") || profileId === null || !/^[0-9a-f-]{36}$/i.test(profileId)) return json(response, 400, { error: "invalid_image_metadata" });
          const cardVisible = url.searchParams.get("cardVisible") === "true";
          const capturedAtValue = url.searchParams.get("capturedAt");
          if (capturedAtValue !== null && !Number.isFinite(new Date(capturedAtValue).getTime())) return json(response, 400, { error: "invalid_captured_at" });
          const bytes = await binaryBody(request); let validation;
          try { validation = validateOriginalImage(bytes, cardVisible); } catch { return json(response, 415, { error: "unsupported_or_invalid_image" }); }
          const imageId = randomUUID(); const relativePath = await images.writeOriginal({ garmentId, imageId, extension: validation.extension, bytes });
          try {
            const image = await photography.addImage({ imageId, garmentId, profileId, role: role as ImageRole, filename, relativePath, cardVisible, capturedAt: capturedAtValue === null ? null : new Date(capturedAtValue).toISOString(), timestamp: now().toISOString(), validation });
            return json(response, 201, { image, readiness: await photography.readiness(garmentId) });
          } catch (error) { await images.removeOriginal(relativePath); throw error; }
        }
        return json(response, 405, { error: "method_not_allowed" });
      }
      const garmentFingerprintMatch = /^\/api\/garments\/([0-9a-f-]{36})\/fingerprint$/i.exec(pathname);
      if (garmentFingerprintMatch !== null) {
        const garmentId = garmentFingerprintMatch[1]!;
        if (method === "GET") { const current = await fingerprints.current(garmentId); return current === null ? json(response, 404, { error: "fingerprint_not_found" }) : json(response, 200, current); }
        if (method === "POST") {
          const sources = await fingerprints.currentImages(garmentId);
          if (sources.length === 0) return json(response, 409, { error: "accepted_photograph_required" });
          const measured = await Promise.all(sources.map(async (source) => ({ ...source, measurements: await measureImage(await images.read(source.relativePath)) })));
          const whole = measured.find((source) => source.role === "whole") ?? null; const detail = measured.find((source) => source.role === "detail") ?? null;
          const fingerprint = combineFingerprint(whole?.measurements ?? null, detail?.measurements ?? null); const suggestions = suggestFields(fingerprint);
          return json(response, 201, await fingerprints.save({ fingerprintId: randomUUID(), garmentId, fingerprint, suggestions, wholeImageId: whole?.id ?? null, detailImageId: detail?.id ?? null, timestamp: now().toISOString() }));
        }
        return json(response, 405, { error: "method_not_allowed" });
      }
      const fingerprintDecisionMatch = /^\/api\/fingerprints\/([0-9a-f-]{36})\/decision$/i.exec(pathname);
      if (fingerprintDecisionMatch !== null) {
        if (method !== "POST") return json(response, 405, { error: "method_not_allowed" });
        const fields = z.enum(["category","formality","seasons","colour_summary","pattern_summary"]);
        const decision = z.object({ accepted: z.array(fields), rejected: z.array(fields) }).strict().refine((value) => !value.accepted.some((field) => value.rejected.includes(field)), "A field cannot be both accepted and rejected").parse(await body(request));
        return await fingerprints.decide(fingerprintDecisionMatch[1]!, decision.accepted, decision.rejected, now().toISOString()) ? json(response, 200, { recorded: true }) : json(response, 409, { error: "fingerprint_not_current" });
      }
      const imageContentMatch = /^\/api\/images\/([0-9a-f-]{36})\/content$/i.exec(pathname);
      if (imageContentMatch !== null) {
        if (method !== "GET" && method !== "HEAD") return json(response, 405, { error: "method_not_allowed" });
        const image = await photography.image(imageContentMatch[1]!); if (image === null) return json(response, 404, { error: "not_found" });
        const content = await images.read(String(image.relativePath)); secure(response); response.writeHead(200, { "content-type": String(image.mediaType), "content-length": String(content.length), "content-disposition": "inline" }); return method === "HEAD" ? response.end() : response.end(content);
      }
    } catch (error) {
      if (error instanceof ZodError) return json(response, 400, { error: "validation_failed", issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) });
      if (error instanceof Error && error.message === "invalid_json") return json(response, 400, { error: "invalid_json" });
      if (error instanceof Error && error.message === "request_too_large") return json(response, 413, { error: "request_too_large" });
      if (error instanceof Error && error.message === "empty_image") return json(response, 400, { error: "empty_image" });
      const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
      if (code === "23503") return json(response, 400, { error: "invalid_relationship" });
      if (code === "23505") return json(response, 409, { error: "already_exists" });
      return json(response, 500, { error: "internal_error" });
    }
    if (method !== "GET" && method !== "HEAD") return json(response, 405, { error: "method_not_allowed" });
    const file = staticFile(input.publicDirectory, pathname);
    if (file === null || !Object.hasOwn(contentTypes, extname(file))) return json(response, 404, { error: "not_found" });
    secure(response);
    response.setHeader("content-type", contentTypes[extname(file)] ?? "application/octet-stream");
    if (method === "HEAD") return response.end();
    const stream = createReadStream(file);
    stream.once("error", () => {
      if (!response.headersSent) json(response, 404, { error: "not_found" });
      else response.destroy();
    });
    stream.pipe(response);
  });
}

export async function startDressedApi(environment: NodeJS.ProcessEnv): Promise<void> {
  const config = loadConfig(environment);
  const database = createDatabasePool({ connectionString: config.databaseUrl, production: config.environment === "production" });
  const server = createDressedServer({ database, publicDirectory: join(applicationRoot(environment), "dist", "frontend"), storageRoot: config.storageRoot });
  server.on("close", () => void database.end());
  server.listen(config.port, "127.0.0.1", () => process.stdout.write(`Dress'Ed: http://127.0.0.1:${config.port}\n`));
  const shutdown = () => server.close();
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  server.once("close", () => {
    process.removeListener("SIGINT", shutdown);
    process.removeListener("SIGTERM", shutdown);
  });
}

const invoked = process.argv[1];
if (invoked !== undefined && import.meta.url === pathToFileURL(invoked).href) {
  startDressedApi(process.env).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Dress'Ed startup failed"}\n`);
    process.exitCode = 1;
  });
}
