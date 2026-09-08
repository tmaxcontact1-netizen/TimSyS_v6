import { createHash } from "node:crypto";

export const APPLICATION_PROTOCOL = "timsys.application.v1";

export class InvalidTransitionError extends Error {
  constructor(from, to) { super(`Invalid state transition: ${from} -> ${to}`); this.name = "InvalidTransitionError"; this.from = from; this.to = to; }
}

export function createStateMachine(table) {
  const normalized = Object.freeze(Object.fromEntries(Object.entries(table).map(([state, targets]) => [state, Object.freeze([...targets])])));
  return Object.freeze({
    canTransition: (from, to) => normalized[from]?.includes(to) === true,
    transition(from, to) { if (!normalized[from]?.includes(to)) throw new InvalidTransitionError(from, to); return to; },
    allowedFrom: (from) => normalized[from] || Object.freeze([]),
  });
}

export function createRuleResult(input) {
  if (!input.explanation?.trim()) throw new TypeError("Rule result explanation is required");
  return Object.freeze({ ...input, evidenceIds: Object.freeze([...(input.evidenceIds || [])]), measurements: Object.freeze([...(input.measurements || [])]) });
}

export function createApplicationHealth(input) {
  if (!input.application?.trim()) throw new TypeError("Application identity is required");
  if (!Number.isFinite(Date.parse(input.observedAt))) throw new TypeError("observedAt must be an ISO date-time");
  return Object.freeze({ protocol: APPLICATION_PROTOCOL, ...input, components: Object.freeze(input.components.map((component) => Object.freeze({ ...component }))) });
}

export function contentHash(value) { return createHash("sha256").update(value).digest("hex"); }

export function retryDelay(attempt, policy) {
  const exponent = Math.max(0, attempt - 1);
  return Math.min(policy.maximumDelayMs, policy.baseDelayMs * (2 ** exponent));
}

export function redact(value) {
  const sensitive = /authorization|cookie|secret|token|password|database.?url|private.?path/i;
  if (Array.isArray(value)) return value.map(redact);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sensitive.test(key) ? "[REDACTED]" : redact(item)]));
}

async function limitedJson(response, maximumBytes) {
  const declared = response.headers.get("content-length");
  if (declared !== null && Number(declared) > maximumBytes) throw new Error("HTTP response exceeds configured size limit");
  if (response.body === null) return null;
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      length += item.value.byteLength;
      if (length > maximumBytes) throw new Error("HTTP response exceeds configured size limit");
      chunks.push(item.value);
    }
  } finally { reader.releaseLock(); }
  if (length === 0) return null;
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

export class BoundedJsonHttpTransport {
  constructor(options) { this.options = options; this.timeoutMs = options.timeoutMs ?? 10000; this.maximumResponseBytes = options.maximumResponseBytes ?? 2000000; this.fetcher = options.fetch ?? fetch; if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs < 1 || !Number.isSafeInteger(this.maximumResponseBytes) || this.maximumResponseBytes < 1) throw new RangeError("HTTP limits must be positive integers"); }
  async request(method, url, body, headers = {}) { const target = new URL(url); if (target.protocol !== "https:" || !this.options.allowedOrigins.has(target.origin)) throw new Error("Outbound HTTP target is not allowlisted"); const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), this.timeoutMs); try { const response = await this.fetcher(target, { method, redirect: "error", signal: controller.signal, headers: { Accept: "application/json", ...headers, ...(body === null ? {} : { "Content-Type": "application/json" }) }, ...(body === null ? {} : { body: JSON.stringify(body) }) }); return Object.freeze({ status: response.status, body: await limitedJson(response, this.maximumResponseBytes), receivedAt: new Date().toISOString() }); } finally { clearTimeout(timeout); } }
  get(url, headers = {}) { return this.request("GET", url, null, headers); }
  post(url, body, headers = {}) { return this.request("POST", url, body, headers); }
}
