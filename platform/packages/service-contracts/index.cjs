"use strict";
const PROTOCOL = "timsys.services.v1";
const APPS = Object.freeze(["principaled", "dressed", "researched", "tradeed"]);
const VERSION = /^\d+\.\d+\.\d+$/;
const IDENTIFIER = /^[a-z][a-z0-9_-]{0,63}$/;
const { assertSchema, validate } = require("./schema.cjs");
class ServiceError extends Error {
  constructor(code, message, status = 0) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.status = status;
  }
}
class TimSysServiceClient {
  constructor({
    baseUrl,
    appId,
    getToken,
    fetch: fetcher = globalThis.fetch,
    timeoutMs = 10000,
    maximumResponseBytes = 131072,
  }) {
    const url = new URL(baseUrl);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/" ||
      !(
        url.protocol === "https:" ||
        (url.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
      )
    )
      throw new TypeError("Invalid TimSyS service origin");
    if (
      !APPS.includes(appId) ||
      typeof getToken !== "function" ||
      typeof fetcher !== "function"
    )
      throw new TypeError("Invalid service client");
    if (
      !Number.isSafeInteger(timeoutMs) ||
      timeoutMs < 1 ||
      timeoutMs > 60000 ||
      !Number.isSafeInteger(maximumResponseBytes) ||
      maximumResponseBytes < 1 ||
      maximumResponseBytes > 1048576
    )
      throw new TypeError("Invalid service client bounds");
    Object.assign(this, {
      baseUrl: url.origin,
      appId,
      getToken,
      fetcher,
      timeoutMs,
      maximumResponseBytes,
    });
  }
  async request(method, path, body, signal, idempotencyKey) {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const token = await this.getToken();
      if (!token)
        throw new ServiceError("AUTH_REQUIRED", "Authentication required");
      const response = await this.fetcher(
        this.baseUrl + "/api/timsys/v1/apps/" + this.appId + "/services" + path,
        {
          method,
          redirect: "error",
          headers: {
            Authorization: "Bearer " + token,
            Accept: "application/json",
            ...(idempotencyKey
              ? { "X-TimSys-Idempotency-Key": idempotencyKey }
              : {}),
            ...(body === undefined
              ? {}
              : { "Content-Type": "application/json" }),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: signal
            ? AbortSignal.any([signal, controller.signal])
            : controller.signal,
        },
      );
      const chunks = [];
      let length = 0;
      const reader = response.body?.getReader();
      if (reader)
        try {
          while (true) {
            const item = await reader.read();
            if (item.done) break;
            length += item.value.byteLength;
            if (length > this.maximumResponseBytes) {
              await reader.cancel();
              throw new ServiceError(
                "RESPONSE_TOO_LARGE",
                "Service response exceeds limit",
              );
            }
            chunks.push(item.value);
          }
        } finally {
          reader.releaseLock();
        }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      const result = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      );
      if (!response.ok || result.success !== true)
        throw new ServiceError(
          result.error?.code || "SERVICE_FAILED",
          result.error?.message || "Service request failed",
          response.status,
        );
      if (
        result.meta?.protocol !== PROTOCOL ||
        result.meta?.appId !== this.appId
      )
        throw new ServiceError(
          "PROTOCOL_MISMATCH",
          "Unsupported service response",
        );
      return result;
    } finally {
      clearTimeout(timer);
    }
  }
  list(options = {}) {
    return this.request("GET", "", undefined, options.signal);
  }
  contract(serviceId, version, options = {}) {
    this.assertTarget(serviceId, version);
    return this.request(
      "GET",
      "/" + serviceId + "/contracts/" + version,
      undefined,
      options.signal,
    );
  }
  invoke(serviceId, version, operation, input = {}, options = {}) {
    this.assertTarget(serviceId, version);
    if (!IDENTIFIER.test(operation)) throw new TypeError("Invalid operation");
    return this.request(
      "POST",
      "/" + serviceId + "/contracts/" + version + "/operations/" + operation,
      input,
      options.signal,
      options.idempotencyKey,
    );
  }
  assertTarget(id, version) {
    if (!IDENTIFIER.test(id) || !VERSION.test(version))
      throw new TypeError("Pin an exact service contract version");
  }
}
module.exports = {
  PROTOCOL,
  APPS,
  VERSION,
  IDENTIFIER,
  assertSchema,
  validate,
  ServiceError,
  TimSysServiceClient,
};
