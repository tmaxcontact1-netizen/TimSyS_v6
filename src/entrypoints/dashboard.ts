import { createReadStream } from "node:fs";
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
} from "../infrastructure/database/paper-dashboard.js";
import { readPaperPerformanceReport } from "../workers/health-worker.js";

const contentTypes: Readonly<Record<string, string>> = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
});
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export interface PaperDashboardDependencies {
  readonly database: Pick<Pool, "query" | "end">;
  readonly wallet: WalletAddress;
  readonly publicDirectory: string;
  readonly now?: () => Date;
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
  await verifyRuntimeDatabase(database, "paper");
  const server = createPaperDashboardServer({
    database,
    wallet: config.paper.walletAddress as WalletAddress,
    publicDirectory: join(process.cwd(), "frontend"),
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
