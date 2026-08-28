import { describe, expect, it } from "vitest";
import { createStateMachine } from "../../src/domain/shared/state-machine.js";
import { asContentHash, asEntityId, asTimestamp } from "../../src/domain/shared/types.js";
import { loadConfig } from "../../src/infrastructure/config/load-config.js";
import { redact } from "../../src/infrastructure/runtime/redaction.js";

describe("Dress'Ed foundation", () => {
  it("provides deterministic guarded state transitions", () => {
    const machine = createStateMachine({ ready: ["working"], working: ["ready"] } as const);
    expect(machine.transition("ready", "working")).toBe("working");
    expect(() => machine.transition("ready", "ready")).toThrow(/Invalid state transition/);
  });

  it("validates canonical identities, timestamps, and hashes", () => {
    expect(asEntityId("11111111-1111-4111-8111-111111111111")).toBeTruthy();
    expect(asTimestamp("2026-08-28T00:00:00.000Z")).toBeTruthy();
    expect(asContentHash("a".repeat(64))).toBeTruthy();
    expect(() => asContentHash("not-a-hash")).toThrow();
  });

  it("accepts only a local CV boundary and absolute private paths", () => {
    const environment = {
      DRESSED_ENV: "test",
      DRESSED_INSTANCE_ID: "foundation-test",
      DRESSED_LOG_LEVEL: "fatal",
      DRESSED_CONFIG_DIR: "C:\\dressed-config",
      DRESSED_STORAGE_ROOT: "C:\\dressed-storage",
      DRESSED_DATABASE_URL: "postgresql://user:pass@127.0.0.1/dressed",
      DRESSED_CV_BASE_URL: "http://127.0.0.1:8091/",
      DRESSED_CV_TIMEOUT_MS: "5000",
    };
    expect(loadConfig(environment)).toMatchObject({ cvBaseUrl: "http://127.0.0.1:8091", cvTimeoutMs: 5000 });
    expect(() => loadConfig({ ...environment, DRESSED_CV_BASE_URL: "https://remote.example" })).toThrow(/CV service must be local/);
  });

  it("redacts nested private configuration without mutating ordinary facts", () => {
    expect(redact({ databaseUrl: "secret", nested: { token: "secret", count: 2 } })).toEqual({
      databaseUrl: "[REDACTED]",
      nested: { token: "[REDACTED]", count: 2 },
    });
  });
});

