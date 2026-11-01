"use strict";
const { ServiceHost, HostError } = require("../../shared/service-host");
const { PROTOCOL } = require("../../packages/service-contracts/index.cjs");
const runtimeContract = require("./runtime-contract.json");
const crypto = require("node:crypto");
function boot(ctx) {
  ctx.db.query(
    "UPDATE service_host_calls SET status='interrupted',error_code='HOST_RESTARTED',completed_at=? WHERE status='running'",
    [Date.now()],
  );
  ctx.serviceHost = new ServiceHost(ctx);
  ctx.wardrobe =
    new (require("../../services/wardrobe/service.cjs").WardrobeService)({log:ctx.log});
  const wardrobe = require("../../services/wardrobe/contract.cjs");
  ctx.serviceHost.register(wardrobe.contract, ctx.wardrobe.handlers());
  ctx.photography=new (require("../../services/photography/service.cjs").PhotographyService)(ctx.wardrobe);
  ctx.serviceHost.register(require("../../services/photography/contract.cjs").contract,ctx.photography.handlers());
  ctx.styling=new (require('../../services/styling/service.cjs').StylingService)(ctx.wardrobe);
  ctx.serviceHost.register(require('../../services/styling/contract.cjs').contract,ctx.styling.handlers());
  ctx.serviceHost.register(runtimeContract, {
    status: async (_input, caller) => ({
      owner: "timsys",
      appId: caller.appId,
      protocol: PROTOCOL,
      state: "ready",
      domainMigrationComplete: false,
    }),
  });
  ctx.serviceHost.register(require('./runtime-contract-1.1.json'),{status:async(_input,caller)=>({owner:'timsys',appId:caller.appId,protocol:PROTOCOL,state:'ready',domainMigrationComplete:true})});
  ctx.log.info("TimSyS-owned service host ready", {
    protocol: PROTOCOL,
    domainMigrationComplete: true,
  });
}
function teardown(ctx) {
  ctx.serviceHost?.close();
  void ctx.wardrobe?.close();
}
function read(req, ctx, fn) {
  const meta = {
    protocol: PROTOCOL,
    requestId: crypto.randomUUID(),
    appId: req.params.appId,
  };
  try {
    return { success: true, data: fn(ctx.serviceHost), meta };
  } catch (error) {
    return {
      success: false,
      statusCode: error instanceof HostError ? error.status : 500,
      error: {
        code: error instanceof HostError ? error.code : "SERVICE_FAILED",
        message:
          error instanceof HostError ? error.message : "Service request failed",
      },
      meta,
    };
  }
}
async function list(req, ctx) {
  return read(req, ctx, (host) => host.list(req.user, req.params.appId));
}
async function contract(req, ctx) {
  return read(req, ctx, (host) =>
    host.contract(
      req.user,
      req.params.appId,
      req.params.serviceId,
      req.params.version,
    ),
  );
}
async function invoke(req, ctx) {
  return ctx.serviceHost.invoke({
    user: req.user,
    appId: req.params.appId,
    serviceId: req.params.serviceId,
    version: req.params.version,
    operation: req.params.operation,
    input: req.body,
    signal: req.signal,
    idempotencyKey: req.headers?.["x-timsys-idempotency-key"],
  });
}
async function configureWardrobe(req, ctx) {
  const crypto = require("node:crypto");
  const expected = process.env.TIMSYS_DESKTOP_TOKEN,
    supplied = req.headers?.["x-timsys-desktop-token"];
  if (
    typeof expected !== "string" ||
    expected.length < 32 ||
    typeof supplied !== "string" ||
    Buffer.byteLength(expected) !== Buffer.byteLength(supplied) ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))
  )
    return {
      success: false,
      statusCode: 403,
      error: {
        code: "NATIVE_HOST_REQUIRED",
        message: "Native host authorization required",
      },
    };
  try {
    await ctx.wardrobe.configure({ ...req.body, ownerId: String(req.user.id) });
    return { success: true, data: { configured: true } };
  } catch (error) {
    return {
      success: false,
      statusCode: error.status || 503,
      error: {
        code: error.code || "WARDROBE_CONFIGURATION_FAILED",
        message: error.code
          ? error.message
          : "Wardrobe configuration could not be verified",
      },
    };
  }
}
async function uploadBinary(req,res,ctx){return require('../../services/photography/transport.cjs').upload(req,res,ctx);}
async function imageBinary(req,res,ctx){return require('../../services/photography/transport.cjs').image(req,res,ctx);}
module.exports = { uploadBinary,imageBinary, boot, teardown, list, contract, invoke, configureWardrobe };
