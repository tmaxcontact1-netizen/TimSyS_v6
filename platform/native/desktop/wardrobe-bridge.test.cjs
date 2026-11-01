const test = require("node:test"),
  assert = require("node:assert/strict");
const { createWardrobeBridge } = require("./wardrobe-bridge.cjs");
test('old app bundles are rejected before a competing catalogue writer can start',()=>{
  const {assertWardrobeDeclaration}=require('./wardrobe-bridge.cjs');
  assert.throws(()=>assertWardrobeDeclaration({protocol:'timsys.services.v1',appId:'dressed',host:'timsys',contracts:[{serviceId:'runtime',version:'1.0.0',operations:['status']}]}),/update the app/);
  assert.doesNotThrow(()=>assertWardrobeDeclaration({protocol:'timsys.services.v1',appId:'dressed',host:'timsys',contracts:[{serviceId:'wardrobe',version:'1.0.0',operations:['create','get']}]}));
});
test("native bridge pins app service version and forwards command identity without exposing a token", async () => {
  const calls = [],
    sender = {};
  const bridge = createWardrobeBridge({
    authorize: (e) => e.sender === sender,
    client: async () => ({
      invoke: async (...args) => {
        calls.push(args);
        return { success: true, data: { id: "record" } };
      },
    }),
  });
  const request = {
    operation: "create",
    input: { name: "Coat" },
    idempotencyKey: "stable-command-identity",
  };
  assert.deepEqual(await bridge({ sender }, request), {
    success: true,
    data: { id: "record" },
  });
  assert.deepEqual(calls[0], [
    "wardrobe",
    "1.0.0",
    "create",
    { name: "Coat" },
    { idempotencyKey: request.idempotencyKey },
  ]);
  await assert.rejects(bridge({ sender: {} }, request), /window required/);
});
test("bridge rejects arbitrary operations and masks transport exception details", async () => {
  const bridge = createWardrobeBridge({
    authorize: () => true,
    client: async () => ({
      invoke: async () => {
        throw Error("private://database-password");
      },
    }),
  });
  await assert.rejects(
    bridge({}, { operation: "arbitrary-query", input: {} }),
    /Invalid wardrobe/,
  );
  const response = await bridge(
    {},
    { operation: "list", input: { limit: 10, offset: 0 } },
  );
  assert.equal(response.success, false);
  assert.equal(JSON.stringify(response).includes("password"), false);
});
