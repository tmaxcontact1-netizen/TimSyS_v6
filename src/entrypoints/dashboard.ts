import { createReadStream } from "node:fs";
import { createHash, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize } from "node:path";
import { pathToFileURL } from "node:url";

import type { Pool } from "pg";

import type { MintAddress, WalletAddress } from "../domain/shared/types.js";
import { loadRuntimeConfig } from "../infrastructure/config/load-config.js";
import { verifyRuntimeDatabase } from "../infrastructure/database/migrations.js";
import { createRuntimePool } from "../infrastructure/database/pool.js";
import {
  paperPerformanceRanges,
  readPaperDashboardDetails,
  readPaperPerformanceHistory,
  readPaperTokenDetails,
  readPaperWorkerAlerts,
} from "../infrastructure/database/paper-dashboard.js";
import {
  addDashboardWatchlistToken,
  createDashboardWatchlist,
  deleteDashboardWatchlist,
  listDashboardWatchlists,
  removeDashboardWatchlistToken,
  renameDashboardWatchlist,
  WatchlistConflictError,
} from "../infrastructure/database/dashboard-watchlists.js";
import { readPaperPerformanceReport } from "../workers/health-worker.js";

const contentTypes: Readonly<Record<string, string>> = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
});
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface PaperDashboardDependencies {
  readonly database: Pick<Pool, "query" | "end">;
  readonly wallet: WalletAddress;
  readonly publicDirectory: string;
  readonly now?: () => Date;
  readonly mutationToken?: string;
}

function authorized(request: IncomingMessage, token: string | undefined): boolean {
  if (token === undefined) return false;
  const supplied = request.headers.authorization;
  if (supplied === undefined || !supplied.startsWith("Bearer ")) return false;
  const left = createHash("sha256").update(supplied.slice(7)).digest();
  const right = createHash("sha256").update(token).digest();
  return timingSafeEqual(left, right);
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const contentType = request.headers["content-type"] ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) throw new Error("content_type");
  let body = "";
  for await (const chunk of request) {
    body += String(chunk);
    if (Buffer.byteLength(body) > 16_384) throw new Error("body_too_large");
  }
  const value: unknown = JSON.parse(body);
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("invalid_body");
  return value as Record<string, unknown>;
}

function validName(value: unknown): value is string {
  return (
    typeof value === "string" && value.trim() === value && value.length >= 1 && value.length <= 80
  );
}

function validVersion(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function secureHeaders(response: ServerResponse): void {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'",
  );
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  secureHeaders(response);
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

function publicFile(publicDirectory: string, pathname: string): string | null {
  const requested = pathname === "/" ? "index.html" : pathname.slice(1);
  const relative = normalize(requested);
  if (relative.startsWith("..") || relative.includes("/../") || relative.includes("\\"))
    return null;
  return join(publicDirectory, relative);
}

export function createPaperDashboardServer(dependencies: PaperDashboardDependencies) {
  const now = dependencies.now ?? (() => new Date());
  return createServer(async (request: IncomingMessage, response: ServerResponse) => {
    const method = request.method ?? "GET";
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const pathname = url.pathname;
    const watchlistMatch = pathname.match(/^\/api\/watchlists\/([0-9a-f-]+)$/i);
    const tokenMatch = pathname.match(
      /^\/api\/watchlists\/([0-9a-f-]+)\/tokens(?:\/([1-9A-HJ-NP-Za-km-z]+))?$/,
    );
    if (pathname === "/api/watchlists" && method === "GET") {
      try {
        const watchlists = await listDashboardWatchlists(
          dependencies.database,
          dependencies.wallet,
        );
        sendJson(response, 200, { watchlists });
      } catch {
        sendJson(response, 503, { error: "watchlists_unavailable" });
      }
      return;
    }
    if (pathname.startsWith("/api/watchlists") && method !== "GET") {
      if (!authorized(request, dependencies.mutationToken)) {
        sendJson(response, 401, { error: "mutation_authentication_required" });
        return;
      }
      if (request.headers.origin !== `http://${request.headers.host}`) {
        sendJson(response, 403, { error: "invalid_mutation_origin" });
        return;
      }
      try {
        const body = await readJson(request);
        if (pathname === "/api/watchlists" && method === "POST") {
          if (!validName(body.name)) throw new Error("invalid_watchlist_name");
          const watchlist = await createDashboardWatchlist(
            dependencies.database,
            dependencies.wallet,
            body.name,
            now(),
          );
          sendJson(response, 201, { watchlist });
          return;
        }
        const id = watchlistMatch?.[1] ?? tokenMatch?.[1];
        if (id === undefined || !UUID.test(id)) throw new Error("invalid_watchlist_id");
        if (!validVersion(body.expectedVersion)) throw new Error("invalid_expected_version");
        if (watchlistMatch !== null && method === "PATCH") {
          if (!validName(body.name)) throw new Error("invalid_watchlist_name");
          const watchlist = await renameDashboardWatchlist(
            dependencies.database,
            dependencies.wallet,
            id,
            body.name,
            body.expectedVersion,
            now(),
          );
          sendJson(response, 200, { watchlist });
          return;
        }
        if (watchlistMatch !== null && method === "DELETE") {
          if (!validName(body.confirmedName)) throw new Error("invalid_confirmation");
          await deleteDashboardWatchlist(
            dependencies.database,
            dependencies.wallet,
            id,
            body.expectedVersion,
            body.confirmedName,
            now(),
          );
          response.writeHead(204, { "Cache-Control": "no-store" });
          response.end();
          return;
        }
        const pathMint = tokenMatch?.[2];
        const mint = method === "POST" ? body.mint : pathMint;
        if (typeof mint !== "string" || !SOLANA_ADDRESS.test(mint))
          throw new Error("invalid_token_mint");
        if (tokenMatch !== null && method === "POST" && pathMint === undefined) {
          const watchlist = await addDashboardWatchlistToken(
            dependencies.database,
            dependencies.wallet,
            id,
            mint as MintAddress,
            body.expectedVersion,
            now(),
          );
          sendJson(response, 200, { watchlist });
          return;
        }
        if (tokenMatch !== null && method === "DELETE" && pathMint !== undefined) {
          const watchlist = await removeDashboardWatchlistToken(
            dependencies.database,
            dependencies.wallet,
            id,
            mint as MintAddress,
            body.expectedVersion,
            now(),
          );
          sendJson(response, 200, { watchlist });
          return;
        }
        sendJson(response, 405, { error: "method_not_allowed" });
      } catch (error) {
        if (error instanceof WatchlistConflictError) {
          sendJson(response, 409, { error: "watchlist_version_conflict" });
        } else if (
          error instanceof Error &&
          [
            "content_type",
            "body_too_large",
            "invalid_body",
            "invalid_watchlist_name",
            "invalid_watchlist_id",
            "invalid_expected_version",
            "invalid_confirmation",
            "invalid_token_mint",
          ].includes(error.message)
        ) {
          sendJson(response, 400, { error: error.message });
        } else {
          sendJson(response, 503, { error: "watchlist_mutation_unavailable" });
        }
      }
      return;
    }
    if (method !== "GET") {
      sendJson(response, 405, { error: "method_not_allowed" });
      return;
    }
    if (pathname === "/api/paper/snapshot") {
      try {
        const performance = await readPaperPerformanceReport(
          dependencies.database,
          dependencies.wallet,
        );
        sendJson(response, 200, { mode: "paper", observedAt: now().toISOString(), performance });
      } catch {
        sendJson(response, 503, { error: "paper_snapshot_unavailable" });
      }
      return;
    }
    if (pathname === "/api/paper/details") {
      try {
        const details = await readPaperDashboardDetails(dependencies.database, dependencies.wallet);
        sendJson(response, 200, { mode: "paper", observedAt: now().toISOString(), details });
      } catch {
        sendJson(response, 503, { error: "paper_details_unavailable" });
      }
      return;
    }
    if (pathname === "/api/paper/alerts") {
      try {
        const alerts = await readPaperWorkerAlerts(dependencies.database, dependencies.wallet);
        sendJson(response, 200, { mode: "paper", observedAt: now().toISOString(), alerts });
      } catch {
        sendJson(response, 503, { error: "paper_alerts_unavailable" });
      }
      return;
    }
    if (pathname === "/api/paper/performance") {
      const range = url.searchParams.get("range") ?? "7d";
      if (!paperPerformanceRanges.some((candidate) => candidate === range)) {
        sendJson(response, 400, { error: "invalid_performance_range" });
        return;
      }
      try {
        const points = await readPaperPerformanceHistory(
          dependencies.database,
          dependencies.wallet,
          range as (typeof paperPerformanceRanges)[number],
        );
        sendJson(response, 200, {
          mode: "paper",
          observedAt: now().toISOString(),
          range,
          basis: "realized_book_equity",
          points,
        });
      } catch {
        sendJson(response, 503, { error: "paper_performance_unavailable" });
      }
      return;
    }
    if (pathname === "/api/paper/token") {
      const mint = url.searchParams.get("mint");
      if (mint === null || !SOLANA_ADDRESS.test(mint)) {
        sendJson(response, 400, { error: "invalid_token_mint" });
        return;
      }
      try {
        const token = await readPaperTokenDetails(
          dependencies.database,
          dependencies.wallet,
          mint as MintAddress,
        );
        sendJson(response, 200, { mode: "paper", observedAt: now().toISOString(), token });
      } catch {
        sendJson(response, 503, { error: "paper_token_unavailable" });
      }
      return;
    }
    const file = publicFile(dependencies.publicDirectory, pathname);
    if (file === null || !Object.hasOwn(contentTypes, extname(file))) {
      sendJson(response, 404, { error: "not_found" });
      return;
    }
    secureHeaders(response);
    response.setHeader("Content-Type", contentTypes[extname(file)] ?? "application/octet-stream");
    const stream = createReadStream(file);
    stream.once("error", () => {
      if (!response.headersSent) sendJson(response, 404, { error: "not_found" });
      else response.destroy();
    });
    stream.pipe(response);
  });
}

export async function startPaperDashboard(environment: NodeJS.ProcessEnv): Promise<void> {
  const config = loadRuntimeConfig(environment);
  if (config.mode !== "paper" || config.paper === null)
    throw new Error("Paper dashboard requires paper mode");
  const database = createRuntimePool({
    connectionString: config.databaseUrl,
    production: config.environment === "production",
  });
  await verifyRuntimeDatabase(database, "paper", true);
  const mutationToken = environment.PAPER_DASHBOARD_MUTATION_TOKEN;
  if (mutationToken !== undefined && mutationToken.length < 32)
    throw new Error("PAPER_DASHBOARD_MUTATION_TOKEN must contain at least 32 characters");
  const server = createPaperDashboardServer({
    database,
    wallet: config.paper.walletAddress as WalletAddress,
    publicDirectory: join(process.cwd(), "frontend"),
    ...(mutationToken === undefined ? {} : { mutationToken }),
  });
  const port = Number(environment.PAPER_DASHBOARD_PORT ?? "8080");
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535)
    throw new Error("PAPER_DASHBOARD_PORT must be an integer from 1 to 65535");
  server.on("close", () => void database.end());
  server.listen(port, "127.0.0.1", () =>
    process.stdout.write(`Paper dashboard: http://127.0.0.1:${port}\n`),
  );
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(invokedPath).href) {
  startPaperDashboard(process.env).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Dashboard failure"}\n`);
    process.exitCode = 1;
  });
}
