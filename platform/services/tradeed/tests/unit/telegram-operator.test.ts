import { describe, expect, it, vi } from "vitest";
import { TelegramOperatorCycle } from "../../src/application/services/telegram-operator.js";

const update = { updateId: 7n, chatId: "100", userId: "42", text: "/approve approval nonce" };

describe("Telegram operator cycle", () => {
  it("processes an authorized approval exactly once", async () => {
    const decide = vi.fn();
    const send = vi.fn();
    const complete = vi.fn();
    const cycle = new TelegramOperatorCycle(
      { poll: async () => [update], send },
      { latest: async () => 6n, claim: async () => true, complete, fail: vi.fn() },
      { decide } as never,
      new Set(["42"]), "100", async () => "healthy", async () => "stopped",
    );
    await expect(cycle.run()).resolves.toBe(1);
    expect(decide).toHaveBeenCalledWith(expect.objectContaining({
      id: "approval", nonce: "nonce", decision: "approve", actorId: "telegram:42",
    }));
    expect(complete).toHaveBeenCalledWith(7n, expect.stringMatching(/Approved/));
    expect(send).toHaveBeenCalledOnce();
  });

  it("refuses unauthorized commands without invoking authority", async () => {
    const fail = vi.fn();
    const decide = vi.fn();
    const send = vi.fn();
    const cycle = new TelegramOperatorCycle(
      { poll: async () => [{ ...update, userId: "99" }], send },
      { latest: async () => null, claim: async () => true, complete: vi.fn(), fail },
      { decide } as never,
      new Set(["42"]), "100", async () => "healthy", async () => "stopped",
    );
    await expect(cycle.run()).resolves.toBe(0);
    expect(decide).not.toHaveBeenCalled();
    expect(fail).toHaveBeenCalledWith(7n, "Unauthorized Telegram operator");
    expect(send).toHaveBeenCalledWith("100", expect.stringMatching(/refused/));
  });

  it("routes emergency stop to durable runtime control", async () => {
    const stop = vi.fn(async () => "Emergency stop active");
    const cycle = new TelegramOperatorCycle(
      { poll: async () => [{ ...update, text: "/stop" }], send: vi.fn() },
      { latest: async () => null, claim: async () => true, complete: vi.fn(), fail: vi.fn() },
      {} as never, new Set(["42"]), "100", async () => "healthy", stop,
    );
    await expect(cycle.run()).resolves.toBe(1);
    expect(stop).toHaveBeenCalledWith("telegram:42");
  });
});
