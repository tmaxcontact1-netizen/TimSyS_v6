import { describe, expect, it } from "vitest";

import { verifyProviderReadiness } from "../../src/infrastructure/runtime/provider-readiness.js";

const target = {
  primaryRpcUrl: "https://primary.example/rpc?key=secret-one",
  fallbackRpcUrl: "https://fallback.example/rpc?key=secret-two",
  cluster: "mainnet-beta" as const,
};
const mainnetGenesisHash = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";

function transport(
  options: { fallbackHash?: string; fallbackSlot?: number; health?: string } = {},
) {
  return {
    post: async (url: string, body: unknown) => {
      const request = body as { id: number; method: string };
      const fallback = url.includes("fallback");
      const result =
        request.method === "getHealth"
          ? (options.health ?? "ok")
          : request.method === "getGenesisHash"
            ? fallback
              ? (options.fallbackHash ?? mainnetGenesisHash)
              : mainnetGenesisHash
            : fallback
              ? (options.fallbackSlot ?? 1005)
              : 1000;
      return { status: 200, body: { jsonrpc: "2.0", id: request.id, result } };
    },
  } as never;
}

describe("provider readiness", () => {
  it("proves read-only agreement without exposing credential-bearing URLs", async () => {
    const report = await verifyProviderReadiness(target, transport());
    expect(report).toMatchObject({
      primaryHost: "primary.example",
      fallbackHost: "fallback.example",
      primarySlot: 1000,
      fallbackSlot: 1005,
      slotDifference: 5,
    });
    expect(JSON.stringify(report)).not.toContain("secret");
  });

  it("fails closed on network disagreement, lag, or unhealthy providers", async () => {
    await expect(
      verifyProviderReadiness(
        target,
        transport({ fallbackHash: "other-network-00000000000000000000" }),
      ),
    ).rejects.toThrow(/different Solana networks/);
    await expect(
      verifyProviderReadiness(target, transport({ fallbackSlot: 2000 }), 100),
    ).rejects.toThrow(/slot difference/);
    await expect(verifyProviderReadiness(target, transport({ health: "behind" }))).rejects.toThrow(
      /not ok/,
    );
  });

  it("refuses two endpoints on the same origin", async () => {
    await expect(
      verifyProviderReadiness(
        { ...target, fallbackRpcUrl: "https://primary.example/other" },
        transport(),
      ),
    ).rejects.toThrow(/independent RPC origins/);
  });

  it("refuses providers that agree with each other but not the configured cluster", async () => {
    await expect(
      verifyProviderReadiness({ ...target, cluster: "devnet" }, transport()),
    ).rejects.toThrow(/configured Solana cluster/);
  });
});
