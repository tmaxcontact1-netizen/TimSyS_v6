"use strict";
const fs = require("node:fs"),
  path = require("node:path");
const { createTestServer } = require("../../helpers/test-server");
const {
  APPS,
  TimSysServiceClient,
} = require("../../../packages/service-contracts/index.cjs");
describe("app declarations consume versioned TimSyS services", () => {
  let context, token;
  beforeAll(async () => {
    context = await createTestServer("app_service_contracts");
    token = (await context.makeRequest("POST", "/api/auth/dev-login", {})).data
      .token;
  });
  afterAll(async () => context.cleanup());
  for (const appId of APPS)
    test(
      appId + " pins a hosted contract and can call it without an app server",
      async () => {
        const declaration = JSON.parse(
          fs.readFileSync(
            path.resolve(
              __dirname,
              "../../../../apps",
              appId,
              "timsys.services.json",
            ),
            "utf8",
          ),
        );
        expect(declaration).toMatchObject({
          schemaVersion: 1,
          appId,
          host: "timsys",
          protocol: "timsys.services.v1",
          migrationState: appId === "tradeed" ? "external-sandbox-inspection" : "frontend-only",
        });
        if (appId === "tradeed") expect(declaration.implementationOwner).toBe("tradeed-sandbox");
        expect(declaration.requiredPermissions).toContain(
          "app:" + appId + ":use",
        );
        const client = new TimSysServiceClient({
          baseUrl: context.baseUrl,
          appId,
          getToken: () => token,
        });
        for (const contract of declaration.contracts) {
          const advertised = await client.contract(
            contract.serviceId,
            contract.version,
          );
          expect(advertised.data.owner).toBe("timsys");
          if (contract.serviceId !== "runtime") continue;
          for (const operation of contract.operations) {
            const result = await client.invoke(
              contract.serviceId,
              contract.version,
              operation,
              {},
            );
            expect(result.data).toMatchObject({
              owner: "timsys",
              appId,
              domainMigrationComplete: true,
            });
          }
        }
      },
    );
});

