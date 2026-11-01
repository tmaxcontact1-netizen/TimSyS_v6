"use strict";
const { randomUUID, createHash } = require("node:crypto");
const { HostError } = require("../../shared/service-host");
const { WardrobeRepository } = require("./repository.cjs");
const { shapes } = require("./contract.cjs");
const path = require("node:path"),
  fs = require("node:fs/promises");
class WardrobeService {
  constructor({log=console}={}) {
    this.log=log;
    this.pool = null;
    this.ownerId = null;
    this.configurationHash = null;
  }
  async configure(input) {
    if (this.configuring) {
      await this.configuring;
      return this.configure(input);
    }
    this.configuring = this.applyConfiguration(input);
    try {
      return await this.configuring;
    } finally {
      this.configuring = null;
    }
  }
  async applyConfiguration(input) {
    if (
      !input ||
      Object.keys(input).some(
        (k) =>
          !["databaseUrl", "migrationUrl", "ownerId", "storageRoot"].includes(
            k,
          ),
      ) ||
      typeof input.ownerId !== "string" ||
      typeof input.storageRoot !== "string" ||
      !path.isAbsolute(input.storageRoot)
    )
      throw new HostError(
        "INVALID_CONFIGURATION",
        "Invalid wardrobe configuration",
      );
    for (const key of ["databaseUrl", "migrationUrl"]) {
      const url = new URL(input[key]);
      if (
        !["postgres:", "postgresql:"].includes(url.protocol) ||
        !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
        !url.pathname ||
        ["18860", "18861"].includes(url.port)
      )
        throw new HostError(
          "INVALID_CONFIGURATION",
          "An explicit local wardrobe database is required",
        );
    }
    const a = new URL(input.databaseUrl),
      b = new URL(input.migrationUrl);
    if (
      a.hostname !== b.hostname ||
      a.port !== b.port ||
      a.pathname !== b.pathname
    )
      throw new HostError(
        "INVALID_CONFIGURATION",
        "Runtime and migration identities must target the same database",
      );
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          databaseUrl: input.databaseUrl,
          ownerId: input.ownerId,
          storageRoot: path.resolve(input.storageRoot),
        }),
      )
      .digest("hex");
    if (this.configurationHash) {
      if (this.configurationHash !== fingerprint)
        throw new HostError(
          "CONFIGURATION_CONFLICT",
          "Changing the wardrobe data target requires a controlled restart",
          409,
        );
      return;
    }
    const { Pool } = require("pg");
    await require("./migrate.cjs").migrate(
      input.migrationUrl,
      decodeURIComponent(a.username),
    );
    const pool = new Pool({
      connectionString: input.databaseUrl,
      max: 3,
      connectionTimeoutMillis: 3000,
      statement_timeout: 7000,
    });
    this.trackPool(pool);
    try {
      await pool.query("SELECT garment_id FROM dressed.garments LIMIT 0");
      const storageHash = createHash("sha256")
        .update(path.resolve(input.storageRoot))
        .digest("hex");
      await pool.query(
        "INSERT INTO dressed.wardrobe_service_identity(singleton,owner_id,storage_binding_hash) VALUES(true,$1,$2) ON CONFLICT DO NOTHING",
        [input.ownerId, storageHash],
      );
      const identity = (
        await pool.query(
          "SELECT owner_id,storage_binding_hash FROM dressed.wardrobe_service_identity WHERE singleton=true",
        )
      ).rows[0];
      if (
        identity.owner_id !== input.ownerId ||
        identity.storage_binding_hash !== storageHash
      )
        throw new HostError(
          "WARDROBE_IDENTITY_CONFLICT",
          "Wardrobe ownership or storage relocation requires explicit migration",
          409,
        );
    } catch (error) {
      await pool.end();
      throw error;
    }
    this.pool = pool;
    this.ownerId = input.ownerId;
    this.configurationHash = fingerprint;
    this.storageRoot = path.resolve(input.storageRoot);
    await this.cleanupFiles();
  }
  check(caller) {
    if (!this.pool)
      throw new HostError(
        "WARDROBE_NOT_CONFIGURED",
        "Wardrobe connection has not been configured",
        503,
      );
    if (caller.appId !== "dressed" || caller.userId !== this.ownerId)
      throw new HostError(
        "WARDROBE_OWNER_REQUIRED",
        "This wardrobe belongs to another owner",
        403,
      );
    if (caller.signal.aborted)
      throw new HostError("REQUEST_CANCELLED", "Request cancelled", 499);
  }
  handlers() {
    return Object.fromEntries(
      Object.entries(shapes).map(([name, shape]) => {
        const normalize = (input) => {
          try {
            return shape.input.parse(input);
          } catch {
            throw new HostError("INVALID_INPUT", "Wardrobe data is invalid");
          }
        };
        const handler = async (input, caller) => {
          this.check(caller);
          const value = normalize(input);
          return shape.command
            ? this.command(name, value, caller)
            : this.execute(name, value, new WardrobeRepository(this.pool));
        };
        handler.normalizeInput = normalize;
        if (shape.command) handler.commandProtocol = "timsys.atomic-command.v1";
        return [name, handler];
      }),
    );
  }
  async execute(name, input, repo) {
    const at = new Date().toISOString();
    let result;
    switch (name) {
      case "categories":
        result = { items: await repo.categories() };
        break;
      case "uses":
        result = { items: await repo.uses() };
        break;
      case "list":
        result = await repo.list(input);
        break;
      case "get":
        result = await repo.get(input.id);
        if (!result)
          throw new HostError("GARMENT_NOT_FOUND", "Garment not found", 404);
        break;
      case "create_category":
        result = await repo.createCategory(randomUUID(), input, at);
        break;
      case "create":
        result = await repo.create(randomUUID(), input, at);
        break;
      case "update":
        result = await repo.update(input.id, input.garment, at);
        if (!result)
          throw new HostError(
            "VERSION_CONFLICT",
            "Garment changed or was archived",
            409,
          );
        break;
      case "archive":
        if (!(await repo.archive(input.id, input.version, at)))
          throw new HostError(
            "VERSION_CONFLICT",
            "Garment changed or was archived",
            409,
          );
        result = { archived: true };
        break;
      case "delete":
        if (!(await repo.delete(input.id, input.version)))
          throw new HostError(
            "VERSION_CONFLICT",
            "Garment changed or was deleted",
            409,
          );
        result = { deleted: true };
        break;
      default:
        throw new HostError(
          "OPERATION_NOT_FOUND",
          "Unknown wardrobe operation",
          404,
        );
    }
    return JSON.parse(JSON.stringify(result));
  }
  async command(name, input, caller) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL statement_timeout='7000ms'");
      await client.query(
        "INSERT INTO dressed.wardrobe_command_receipts(owner_id,command_key,payload_hash,operation) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
        [caller.userId, caller.idempotencyKey, caller.payloadHash, name],
      );
      const receipt = (
        await client.query(
          "SELECT payload_hash,response FROM dressed.wardrobe_command_receipts WHERE owner_id=$1 AND command_key=$2 FOR UPDATE",
          [caller.userId, caller.idempotencyKey],
        )
      ).rows[0];
      if (receipt.payload_hash !== caller.payloadHash)
        throw new HostError(
          "IDEMPOTENCY_CONFLICT",
          "Command key was already used for different input",
          409,
        );
      let result = receipt.response;
      if (!result) {
        const repo = new WardrobeRepository(
          { query: client.query.bind(client) },
          client,
        );
        result = await this.execute(name, input, repo);
        caller.validateOutput(result);
        if (name === "delete")
          await client.query(
            "INSERT INTO dressed.wardrobe_file_cleanup(garment_id) VALUES($1) ON CONFLICT DO NOTHING",
            [input.id],
          );
        await client.query(
          "UPDATE dressed.wardrobe_command_receipts SET response=$3::jsonb WHERE owner_id=$1 AND command_key=$2",
          [caller.userId, caller.idempotencyKey, JSON.stringify(result)],
        );
      }
      caller.validateOutput(result);
      if (caller.signal.aborted)
        throw new HostError("REQUEST_CANCELLED", "Request cancelled", 499);
      await client.query("COMMIT");
      if (name === "delete") await this.cleanupFiles(client);
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      if (error.code === "23503")
        throw new HostError(
          "INVALID_REFERENCE",
          "Referenced wardrobe record is unavailable",
          409,
        );
      if (error.code === "23505")
        throw new HostError(
          "DUPLICATE_RECORD",
          "A wardrobe record with this identity already exists",
          409,
        );
      throw error;
    } finally {
      client.release();
    }
  }
  async cleanupFiles(connection = this.pool) {
    const rows = (
      await connection.query(
        "SELECT garment_id FROM dressed.wardrobe_file_cleanup WHERE completed_at IS NULL LIMIT 50",
      )
    ).rows;
    for (const { garment_id: id } of rows) {
      const root = path.resolve(this.storageRoot, "images"),
        target = path.resolve(root, id);
      if (!/^[0-9a-f-]{36}$/i.test(id) || path.dirname(target) !== root)
        throw Error("Invalid wardrobe cleanup path");
      try {
        await fs.rm(target, { recursive: true, force: true });
        await connection.query(
          "UPDATE dressed.wardrobe_file_cleanup SET completed_at=now(),error_code=NULL WHERE garment_id=$1",
          [id],
        );
      } catch (error) {
        await connection.query(
          "UPDATE dressed.wardrobe_file_cleanup SET error_code=$2 WHERE garment_id=$1",
          [id, String(error.code || "CLEANUP_FAILED")],
        );
      }
    }
  }
  trackPool(pool){
    // An idle PostgreSQL connection failure must not terminate the shared host.
    pool.on('error',error=>this.log.error('Wardrobe database connection lost',{code:String(error.code||'PG_CONNECTION_LOST')}));
    return pool;
  }
  async close() {
    const pool = this.pool;
    this.pool = null;
    if (pool) await pool.end();
  }
}
module.exports = { WardrobeService };
