"use strict";
const operations=new Set(["catalogue","evaluate","ensemble_catalogue","ensemble_generate","ensemble_save","ensemble_override"]);
function createStylingBridge({ authorize, client }) {
  return async (event, value) => {
    if (!authorize(event)) throw Error("Dress’Ed window required");
    if (
      !value ||
      !operations.has(value.operation) ||
      Buffer.byteLength(JSON.stringify(value.input)) > 32768
    )
      throw Error("Invalid styling request");
    try {
      return await (
        await client()
      ).invoke("styling", "1.0.0", value.operation, value.input, {
        idempotencyKey: value.idempotencyKey,
      });
    } catch (error) {
      return {
        success: false,
        error: {
          code: error.code || "STYLING_UNAVAILABLE",
          message: error.code
            ? error.message
            : "TimSyS styling is unavailable",
          status: error.status || 0,
        },
      };
    }
  };
}
function assertStylingDeclaration(value){const declaration=value?.contracts?.find(c=>c.serviceId==='styling'&&c.version==='1.0.0');if(value?.protocol!=='timsys.services.v1'||value?.appId!=='dressed'||value?.host!=='timsys'||!["catalogue","evaluate","ensemble_catalogue","ensemble_generate","ensemble_save","ensemble_override"].every(op=>declaration?.operations?.includes(op)))throw Error('Update Dress’Ed before using TimSyS styling');}
module.exports={createStylingBridge,assertStylingDeclaration};
