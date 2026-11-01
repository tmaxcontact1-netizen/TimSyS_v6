"use strict";
const crypto = require("node:crypto");
const {
  PROTOCOL,
  APPS,
  VERSION,
  IDENTIFIER,
  assertSchema,
  validate,
} = require("../../packages/service-contracts/index.cjs");
class HostError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    Object.assign(this, { code, status });
  }
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}
const hash = (value) =>
  crypto
    .createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
function freeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
class ServiceHost {
  constructor({ db, auth }) {
    this.db = db;
    this.auth = auth;
    this.services = new Map();
    this.controllers = new Set();
    this.closed = false;
  }
  register(contract, handlers) {
    if (this.closed)
      throw new HostError("HOST_STOPPED", "Service host stopped", 503);
    const copy = JSON.parse(JSON.stringify(contract));
    if (
      copy.owner !== "timsys" ||
      !IDENTIFIER.test(copy.serviceId) ||
      !VERSION.test(copy.version) ||
      !Array.isArray(copy.apps) ||
      !copy.apps.length ||
      copy.apps.some((app) => !APPS.includes(app)) ||
      !copy.operations ||
      !Object.keys(copy.operations).length
    )
      throw new TypeError("Invalid TimSyS-owned contract");
    for (const [name, op] of Object.entries(copy.operations)) {
      if (
        !IDENTIFIER.test(name) ||
        !op.permission ||
        typeof op.permission !== "string" ||
        !(
          op.effect === "read" ||
          (op.effect === "command" &&
            op.idempotency === "required" &&
            handlers[name]?.commandProtocol === "timsys.atomic-command.v1")
        ) ||
        typeof handlers[name] !== "function"
      )
        throw new TypeError(
          "Commands require a trusted atomic command handler",
        );
      for (const [field, maximum] of [
        ["timeoutMs", 30000],
        ["maximumInputBytes", 65536],
        ["maximumOutputBytes", 1048576],
      ])
        if (
          !Number.isSafeInteger(op[field]) ||
          op[field] < 1 ||
          op[field] > maximum
        )
          throw new TypeError("Invalid operation limit");
      assertSchema(op.input);
      assertSchema(op.output);
    }
    const key = copy.serviceId + "@" + copy.version;
    if (this.services.has(key))
      throw new TypeError("Contract version already registered");
    const contractHash = hash(copy);
    this.db.query(
      "INSERT INTO service_host_contracts(service_id,contract_version,contract_hash,contract_json) VALUES(?,?,?,?) ON CONFLICT(service_id,contract_version) DO NOTHING",
      [
        copy.serviceId,
        copy.version,
        contractHash,
        JSON.stringify(canonical(copy)),
      ],
    );
    const stored = this.db.query(
      "SELECT contract_hash FROM service_host_contracts WHERE service_id=? AND contract_version=?",
      [copy.serviceId, copy.version],
    ).rows[0];
    if (stored.contract_hash !== contractHash)
      throw new TypeError(
        "Contract contents changed; publish a new contract version",
      );
    const entry = {
      contract: freeze(copy),
      handlers: Object.freeze({ ...handlers }),
      hash: contractHash,
    };
    this.services.set(key, entry);
    return entry.hash;
  }
  allowed(user, permission) {
    return (
      this.auth.checkPerm(user, "admin:*") ||
      this.auth.checkPerm(user, permission)
    );
  }
  scope(user, appId) {
    if (this.closed)
      throw new HostError("HOST_STOPPED", "Service host stopped", 503);
    if (!user?.id)
      throw new HostError("UNAUTHORIZED", "Authentication required", 401);
    if (!APPS.includes(appId))
      throw new HostError("APP_NOT_FOUND", "Unknown application", 404);
    if (!this.allowed(user, "app:" + appId + ":use"))
      throw new HostError(
        "APP_FORBIDDEN",
        "Caller is not authorized for this application",
        403,
      );
  }
  find(user, appId, serviceId, version) {
    this.scope(user, appId);
    if (!IDENTIFIER.test(serviceId) || !VERSION.test(version))
      throw new HostError(
        "INVALID_CONTRACT_VERSION",
        "Pin an exact contract version",
      );
    const entry = this.services.get(serviceId + "@" + version);
    if (!entry) {
      const known = [...this.services.values()].some(
        (s) =>
          s.contract.serviceId === serviceId && s.contract.apps.includes(appId),
      );
      throw new HostError(
        known ? "CONTRACT_VERSION_UNSUPPORTED" : "SERVICE_NOT_FOUND",
        known ? "Contract version is unavailable" : "Service is unavailable",
        known ? 409 : 404,
      );
    }
    if (!entry.contract.apps.includes(appId))
      throw new HostError("SERVICE_NOT_FOUND", "Service is unavailable", 404);
    return entry;
  }
  describe(entry, user) {
    return { ...entry.contract, contractHash: entry.hash };
  }
  list(user, appId) {
    this.scope(user, appId);
    return {
      services: [...this.services.values()]
        .filter(
          (entry) =>
            entry.contract.apps.includes(appId) &&
            Object.values(entry.contract.operations).some((op) =>
              this.allowed(user, op.permission),
            ),
        )
        .map((entry) => this.describe(entry, user)),
    };
  }
  contract(user, appId, id, version) {
    const entry = this.find(user, appId, id, version);
    if (
      !Object.values(entry.contract.operations).some((op) =>
        this.allowed(user, op.permission),
      )
    )
      throw new HostError(
        "OPERATION_FORBIDDEN",
        "Service permission required",
        403,
      );
    return this.describe(entry, user);
  }
  async invoke({
    user,
    appId,
    serviceId,
    version,
    operation,
    input,
    signal,
    idempotencyKey,
  }) {
    const requestId = crypto.randomUUID(),
      startedAt = Date.now();
    let entry,
      recorded = false,
      controller,
      timer;
    const meta = {
      protocol: PROTOCOL,
      requestId,
      appId,
      serviceId,
      contractVersion: version,
    };
    try {
      entry = this.find(user, appId, serviceId, version);
      meta.contractHash = entry.hash;
      const op =
        Object.hasOwn(entry.contract.operations, operation) &&
        entry.contract.operations[operation];
      if (!op)
        throw new HostError(
          "OPERATION_NOT_FOUND",
          "Unknown service operation",
          404,
        );
      if (!this.allowed(user, op.permission))
        throw new HostError(
          "OPERATION_FORBIDDEN",
          "Service permission required",
          403,
        );
      if (
        op.effect === "command" &&
        (typeof idempotencyKey !== "string" ||
          !/^[a-zA-Z0-9][a-zA-Z0-9_-]{15,127}$/.test(idempotencyKey))
      )
        throw new HostError(
          "IDEMPOTENCY_REQUIRED",
          "A stable command key is required",
          400,
        );
      const encodedInput = JSON.stringify(input);
      if (encodedInput === undefined)
        throw new HostError(
          "INVALID_INPUT",
          "Input does not match the pinned contract",
        );
      if (Buffer.byteLength(encodedInput) > op.maximumInputBytes)
        throw new HostError(
          "INPUT_TOO_LARGE",
          "Service input exceeds limit",
          413,
        );
      if (entry.handlers[operation].normalizeInput)
        input = entry.handlers[operation].normalizeInput(input);
      if (validate(op.input, input).length)
        throw new HostError(
          "INVALID_INPUT",
          "Input does not match the pinned contract",
        );
      this.db.query(
        "INSERT INTO service_host_calls(request_id,app_id,user_id,service_id,contract_version,contract_hash,operation,input_hash,status,started_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
        [
          requestId,
          appId,
          String(user.id),
          serviceId,
          version,
          entry.hash,
          operation,
          hash(input),
          "running",
          startedAt,
        ],
      );
      recorded = true;
      controller = new AbortController();
      this.controllers.add(controller);
      const abort = () => controller.abort(signal?.reason);
      if (signal?.aborted) abort();
      else signal?.addEventListener("abort", abort, { once: true });
      let data;
      try {
        data = await Promise.race([
          Promise.resolve().then(() => {
            if (controller.signal.aborted)
              throw new HostError(
                "REQUEST_CANCELLED",
                "Request cancelled",
                499,
              );
            return entry.handlers[operation](
              input,
              Object.freeze({
                userId: String(user.id),
                appId,
                requestId,
                signal: controller.signal,
                idempotencyKey,
                payloadHash: hash({
                  appId,
                  userId: String(user.id),
                  serviceId,
                  version,
                  operation,
                  input,
                }),
                validateOutput(data) {
                  const encoded = JSON.stringify(data);
                  if (
                    !encoded ||
                    Buffer.byteLength(encoded) > op.maximumOutputBytes ||
                    validate(op.output, data).length
                  )
                    throw new HostError(
                      "INVALID_OUTPUT",
                      "Service returned an invalid response",
                      500,
                    );
                },
              }),
            );
          }),
          new Promise((_, reject) => {
            timer = setTimeout(() => {
              reject(
                new HostError(
                  "SERVICE_TIMEOUT",
                  "Service deadline exceeded",
                  504,
                ),
              );
              controller.abort();
            }, op.timeoutMs);
            controller.signal.addEventListener(
              "abort",
              () =>
                reject(
                  new HostError("REQUEST_CANCELLED", "Request cancelled", 499),
                ),
              { once: true },
            );
          }),
        ]);
      } finally {
        signal?.removeEventListener("abort", abort);
      }
      let encoded;
      try {
        encoded = JSON.stringify(data);
      } catch {
        throw new HostError(
          "INVALID_OUTPUT",
          "Service returned an invalid response",
          500,
        );
      }
      if (
        !encoded ||
        Buffer.byteLength(encoded) > op.maximumOutputBytes ||
        validate(op.output, data).length
      )
        throw new HostError(
          "INVALID_OUTPUT",
          "Service returned an invalid response",
          500,
        );
      this.db.query(
        "UPDATE service_host_calls SET status='completed',completed_at=? WHERE request_id=?",
        [Date.now(), requestId],
      );
      return { success: true, data, meta };
    } catch (error) {
      const known = error instanceof HostError;
      const code = known ? error.code : "SERVICE_FAILED";
      if (recorded)
        this.db.query(
          "UPDATE service_host_calls SET status='failed',error_code=?,completed_at=? WHERE request_id=?",
          [code, Date.now(), requestId],
        );
      return {
        success: false,
        statusCode: known ? error.status : 500,
        error: {
          code,
          message: known ? error.message : "Service request failed",
        },
        meta,
      };
    } finally {
      if (timer) clearTimeout(timer);
      if (controller) this.controllers.delete(controller);
    }
  }
  close() {
    this.closed = true;
    for (const controller of this.controllers) controller.abort();
    this.controllers.clear();
  }
}
module.exports = { ServiceHost, HostError, hash };
