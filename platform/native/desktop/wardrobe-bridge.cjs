"use strict";
const operations = new Set([
  "categories",
  "uses",
  "list",
  "get",
  "create_category",
  "create",
  "update",
  "archive",
  "delete",
]);
function createWardrobeBridge({ authorize, client }) {
  return async (event, value) => {
    if (!authorize(event)) throw Error("Dress’Ed window required");
    if (
      !value ||
      !operations.has(value.operation) ||
      Buffer.byteLength(JSON.stringify(value.input)) > 32768
    )
      throw Error("Invalid wardrobe request");
    try {
      return await (
        await client()
      ).invoke("wardrobe", "1.0.0", value.operation, value.input, {
        idempotencyKey: value.idempotencyKey,
      });
    } catch (error) {
      return {
        success: false,
        error: {
          code: error.code || "WARDROBE_UNAVAILABLE",
          message: error.code
            ? error.message
            : "TimSyS wardrobe is unavailable",
          status: error.status || 0,
        },
      };
    }
  };
}
function assertWardrobeDeclaration(value) {
  if(value?.protocol!=='timsys.services.v1'||value?.appId!=='dressed'||value?.host!=='timsys'||!value?.contracts?.some(contract=>contract.serviceId==='wardrobe'&&contract.version==='1.0.0'&&contract.operations?.includes('create')&&contract.operations?.includes('get')))throw Error('Dress’Ed bundle requires the TimSyS wardrobe contract; update the app before starting it');
}
module.exports = { createWardrobeBridge, assertWardrobeDeclaration };
