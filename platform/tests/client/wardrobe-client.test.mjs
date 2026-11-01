import test from "node:test";
import assert from "node:assert/strict";
import {
  createWardrobeApi,
  wardrobeRoute,
} from "../../packages/service-contracts/wardrobe-client.mjs";
const memory = () => {
  const map = new Map();
  return {
    getItem: (k) => map.get(k) || null,
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
    map,
  };
};
test("app catalogue routes use exact operations and leave photography outside this migration", () => {
  assert.deepEqual(
    wardrobeRoute("/api/garments?limit=500&offset=2&status=all"),
    { operation: "list", input: { limit: 50, offset: 2, status: "all" } },
  );
  assert.equal(
    wardrobeRoute("/api/garments/11111111-1111-4111-8111-111111111111/images"),
    null,
  );
  assert.equal(
    wardrobeRoute("/api/garments/11111111-1111-4111-8111-111111111111", "PUT", {
      version: 7,
    }).operation,
    "update",
  );
});
test("uncertain command retries retain their key across adapter recreation without retaining input text", async () => {
  const storage = memory(),
    keys = [];
  let fail = true;
  const invoke = async (_op, _input, key) => {
    keys.push(key);
    if (fail) throw Object.assign(Error("response lost"), { status: 0 });
    return { id: "saved" };
  };
  const options = {
    method: "POST",
    body: JSON.stringify({ name: "Private note", categoryId: "category" }),
  };
  await assert.rejects(
    createWardrobeApi({ invoke, storage })("/api/garments", options),
  );
  assert.equal(
    JSON.stringify([...storage.map]).includes("Private note"),
    false,
  );
  fail = false;
  assert.deepEqual(
    await createWardrobeApi({ invoke, storage })("/api/garments", options),
    { id: "saved" },
  );
  assert.equal(keys[0], keys[1]);
  assert.equal(storage.map.size, 0);
});
test("definitive validation rejection releases the command key", async () => {
  const storage = memory();
  const api = createWardrobeApi({
    storage,
    invoke: async () => {
      throw Object.assign(Error("bad input"), { status: 400 });
    },
  });
  await assert.rejects(
    api("/api/categories", { method: "POST", body: '{"name":"invalid"}' }),
  );
  assert.equal(storage.map.size, 0);
});
