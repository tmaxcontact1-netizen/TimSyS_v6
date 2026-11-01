"use strict";
const Database = require("better-sqlite3");
const fs = require("node:fs"),
  path = require("node:path");
const { ServiceHost, hash } = require("../../shared/service-host");
const {
  assertSchema,
  validate,
} = require("../../packages/service-contracts/index.cjs");
const template = require("../../modules/service_host/runtime-contract.json");
const user = {
  id: "staff-1",
  permissions: ["app:tradeed:use", "service:runtime:read"],
};
const output = (caller) => ({
  owner: "timsys",
  appId: caller.appId,
  protocol: "timsys.services.v1",
  state: "ready",
  domainMigrationComplete: false,
});
describe("TimSyS service host boundary", () => {
  let host, connection;
  const call = (options = {}) =>
    host.invoke({
      user,
      appId: "tradeed",
      serviceId: "runtime",
      version: "1.0.0",
      operation: "status",
      input: {},
      ...options,
    });
  beforeEach(() => {
    connection = new Database(":memory:");
    connection.exec(
      fs.readFileSync(
        path.join(
          __dirname,
          "../../modules/service_host/migrations/001_service_host.sql",
        ),
        "utf8",
      ),
    );
    host = new ServiceHost({
      auth: { checkPerm: (u, p) => u?.permissions?.includes(p) },
      db: {
        query(sql, params = []) {
          const stmt = connection.prepare(sql);
          return stmt.reader ? { rows: stmt.all(params) } : stmt.run(params);
        },
      },
    });
    host.register(template, {
      status: async (_input, caller) => output(caller),
    });
  });
  afterEach(() => {
    host.close();
    connection.close();
  });
  test("pins immutable contracts with canonical hashes", () => {
    expect(
      host.contract(user, "tradeed", "runtime", "1.0.0").contractHash,
    ).toBe(hash(template));
    expect(hash({ b: 2, a: 1 })).toBe(hash({ a: 1, b: 2 }));
    expect(() => host.register(template, { status: async () => ({}) })).toThrow(
      "already registered",
    );
  });
  test("refuses changing a pinned version after the in-memory registry is recreated", () => {
    host.services.clear();
    const changed = structuredClone(template);
    changed.operations.status.timeoutMs = 1000;
    expect(() => host.register(changed, { status: async () => ({}) })).toThrow(
      "new contract version",
    );
    expect(() =>
      host.register(template, {
        status: async (_input, caller) => output(caller),
      }),
    ).not.toThrow();
  });
  test("executes only server-registered handlers and persists hashed request metadata", async () => {
    const result = await call();
    expect(result).toMatchObject({
      success: true,
      data: output({ appId: "tradeed" }),
      meta: { protocol: "timsys.services.v1", appId: "tradeed" },
    });
    const row = connection.prepare("SELECT * FROM service_host_calls").get();
    expect(row).toMatchObject({
      user_id: "staff-1",
      app_id: "tradeed",
      status: "completed",
      input_hash: hash({}),
    });
    expect(Object.keys(row)).not.toContain("input");
  });
  test("does not let the route or input grant another app identity", async () => {
    expect(await call({ appId: "researched" })).toMatchObject({
      statusCode: 403,
      error: { code: "APP_FORBIDDEN" },
    });
    expect(
      await call({ input: { appId: "researched", userId: "admin" } }),
    ).toMatchObject({ statusCode: 400, error: { code: "INVALID_INPUT" } });
  });
  test("enforces per-operation permissions independently of app permission", async () => {
    expect(
      await call({ user: { id: "staff-1", permissions: ["app:tradeed:use"] } }),
    ).toMatchObject({
      statusCode: 403,
      error: { code: "OPERATION_FORBIDDEN" },
    });
    expect(
      host.list({ id: "staff-1", permissions: ["app:tradeed:use"] }, "tradeed")
        .services,
    ).toEqual([]);
  });
  test("rejects unknown apps, operations, services and incompatible exact versions", async () => {
    expect(await call({ appId: "unknown" })).toMatchObject({ statusCode: 404 });
    expect(await call({ operation: "constructor" })).toMatchObject({
      statusCode: 404,
    });
    expect(await call({ serviceId: "unknown" })).toMatchObject({
      statusCode: 404,
    });
    expect(await call({ version: "2.0.0" })).toMatchObject({
      statusCode: 409,
      error: { code: "CONTRACT_VERSION_UNSUPPORTED" },
    });
    expect(await call({ version: "latest" })).toMatchObject({
      statusCode: 400,
    });
  });
  test("enforces input byte bounds before invoking the handler", async () => {
    expect(await call({ input: { extra: "x".repeat(300) } })).toMatchObject({
      statusCode: 413,
    });
    expect(
      connection.prepare("SELECT COUNT(*) n FROM service_host_calls").get().n,
    ).toBe(0);
  });
  test("fails invalid responses without publishing service output", async () => {
    const contract = structuredClone(template);
    contract.version = "1.1.0";
    host.register(contract, {
      status: async () => ({ secret: "should not escape" }),
    });
    const result = await call({ version: "1.1.0" });
    expect(result).toMatchObject({
      statusCode: 500,
      error: { code: "INVALID_OUTPUT" },
    });
    expect(JSON.stringify(result)).not.toContain("should not escape");
    expect(
      connection.prepare("SELECT status FROM service_host_calls").get().status,
    ).toBe("failed");
  });
  test("masks unexpected handler exceptions", async () => {
    const contract = structuredClone(template);
    contract.version = "1.1.0";
    host.register(contract, {
      status: async () => {
        throw Error("private database password");
      },
    });
    const result = await call({ version: "1.1.0" });
    expect(result.error.code).toBe("SERVICE_FAILED");
    expect(JSON.stringify(result)).not.toContain("password");
  });
  test("times out and signals cooperative cancellation", async () => {
    const contract = structuredClone(template);
    contract.version = "1.1.0";
    contract.operations.status.timeoutMs = 5;
    let signal;
    host.register(contract, {
      status: async (_input, caller) => {
        signal = caller.signal;
        return new Promise(() => {});
      },
    });
    expect(await call({ version: "1.1.0" })).toMatchObject({
      statusCode: 504,
      error: { code: "SERVICE_TIMEOUT" },
    });
    expect(signal.aborted).toBe(true);
  });
  test("supports caller cancellation and stops new work after shutdown", async () => {
    const contract = structuredClone(template);
    contract.version = "1.1.0";
    host.register(contract, { status: async () => new Promise(() => {}) });
    const controller = new AbortController();
    const pending = call({ version: "1.1.0", signal: controller.signal });
    controller.abort();
    expect(await pending).toMatchObject({
      error: { code: "REQUEST_CANCELLED" },
    });
    host.close();
    expect(await call()).toMatchObject({ statusCode: 503 });
  });
  test("rejects app ownership, write effects and schemas outside the supported subset", () => {
    const changed = structuredClone(template);
    changed.owner = "tradeed";
    expect(() => host.register(changed, {})).toThrow();
    changed.owner = "timsys";
    changed.operations.status.effect = "write";
    expect(() => host.register(changed, { status: async () => ({}) })).toThrow(
      "atomic command",
    );
    expect(() =>
      assertSchema({
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
        $ref: "remote",
      }),
    ).toThrow("Unsupported");
    expect(
      validate(template.operations.status.input, JSON.parse('{"__proto__":{}}'))
        .length,
    ).toBeGreaterThan(0);
  });
});

