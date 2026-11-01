"use strict";
const { createTestServer } = require("../../helpers/test-server");
const {
  TimSysServiceClient,
  ServiceError,
} = require("../../../packages/service-contracts/index.cjs");
describe("versioned app contract real HTTP path", () => {
  let context, token, db;
  const route = "/api/timsys/v1/apps/tradeed/services";
  beforeAll(async () => {
    context = await createTestServer("service_host");
    token = (await context.makeRequest("POST", "/api/auth/dev-login", {})).data
      .token;
    db = require("../../../shared/services/db");
  });
  afterAll(async () => {
    await context.cleanup();
  });
  test("discovers and invokes the TimSyS-owned runtime through the browser-compatible client", async () => {
    const client = new TimSysServiceClient({
      baseUrl: context.baseUrl,
      appId: "tradeed",
      getToken: () => token,
    });
    const catalogue = await client.list();
    expect(catalogue.data.services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          serviceId: "runtime",
          version: "1.0.0",
          owner: "timsys",
        }),
      ]),
    );
    const contract = await client.contract("runtime", "1.0.0");
    const result = await client.invoke("runtime", "1.0.0", "status", {});
    expect(result.data).toMatchObject({
      appId: "tradeed",
      owner: "timsys",
      domainMigrationComplete: false,
    });
    expect(result.meta.contractHash).toBe(contract.data.contractHash);
    const saved = db.query(
      "SELECT * FROM service_host_calls WHERE request_id=?",
      [result.meta.requestId],
    ).rows[0];
    expect(saved).toMatchObject({
      app_id: "tradeed",
      status: "completed",
      contract_version: "1.0.0",
    });
  });
  test("requires authentication and rejects incompatible versions and extra input", async () => {
    expect((await context.makeRequest("GET", route)).status).toBe(401);
    expect(
      (
        await context.makeRequest(
          "POST",
          route + "/runtime/contracts/2.0.0/operations/status",
          {},
          token,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await context.makeRequest(
          "POST",
          route + "/runtime/contracts/1.0.0/operations/status",
          { appId: "researched" },
          token,
        )
      ).status,
    ).toBe(400);
  });
  test("enforces signed app and operation grants at the real HTTP boundary", async () => {
    const jwt = require("jsonwebtoken");
    const signed = (permissions) =>
      jwt.sign(
        { userId: "restricted", permissions, sessionId: "service-host-test" },
        process.env.JWT_SECRET,
      );
    const access = [
      "admin:service_host:access",
      "app:tradeed:use",
      "service:runtime:read",
    ];
    const restricted = signed(access);
    expect(
      (
        await context.makeRequest(
          "POST",
          route + "/runtime/contracts/1.0.0/operations/status",
          {},
          restricted,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await context.makeRequest(
          "GET",
          route.replace("tradeed", "researched"),
          null,
          restricted,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await context.makeRequest(
          "POST",
          route + "/runtime/contracts/1.0.0/operations/status",
          {},
          signed(access.slice(0, 2)),
        )
      ).status,
    ).toBe(403);
  });
  test("client enforces exact targets, response protocol, bounds and cancellation", async () => {
    const client = new TimSysServiceClient({
      baseUrl: context.baseUrl,
      appId: "tradeed",
      getToken: () => token,
    });
    expect(() => client.invoke("runtime", "latest", "status")).toThrow("exact");
    const limited = new TimSysServiceClient({
      baseUrl: context.baseUrl,
      appId: "tradeed",
      getToken: () => token,
      maximumResponseBytes: 4,
    });
    await expect(limited.list()).rejects.toMatchObject({
      code: "RESPONSE_TOO_LARGE",
    });
    const controller = new AbortController();
    controller.abort();
    await expect(client.list({ signal: controller.signal })).rejects.toThrow();
    const bad = new TimSysServiceClient({
      baseUrl: context.baseUrl,
      appId: "tradeed",
      getToken: () => token,
      fetch: async () =>
        Response.json({ success: true, meta: { protocol: "wrong" } }),
    });
    await expect(bad.list()).rejects.toBeInstanceOf(ServiceError);
  });
  test("registers the new migration and exposes no caller-controlled registration route", async () => {
    expect(
      db.scalar(
        "SELECT COUNT(*) FROM schema_migrations WHERE version='service_host_001_service_host'",
      ),
    ).toBe(1);
    expect(
      (
        await context.makeRequest(
          "PUT",
          route + "/runtime/contracts/1.0.0",
          { owner: "tradeed" },
          token,
        )
      ).status,
    ).toBe(404);
  });
});
