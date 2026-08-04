import { describe, expect, it } from "vitest";

import { asTimestamp, asUuid, type EvidenceId } from "../../src/domain/shared/types.js";
import { asMintAddress } from "../../src/domain/token/token.js";
import { SolanaMintSecurityAdapter } from "../../src/infrastructure/providers/solana/mint-security-adapter.js";
import {
  SolanaRpcClient,
  type SolanaRpcTransport,
} from "../../src/infrastructure/providers/solana/rpc-client.js";

const mint = asMintAddress("So11111111111111111111111111111111111111112");
const observedAt = asTimestamp("2026-08-04T12:00:00.000Z");
const mintData = Buffer.alloc(82);
mintData.writeUInt32LE(0, 0);
mintData[45] = 1;
mintData.writeUInt32LE(0, 46);

function transport(
  largest = "200",
  owner = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
): SolanaRpcTransport {
  return {
    post: async (request) => {
      const value = request as { id: number; method: string };
      const result =
        value.method === "getAccountInfo"
          ? {
              context: { slot: 10 },
              value: { data: [mintData.toString("base64"), "base64"], owner },
            }
          : value.method === "getTokenLargestAccounts"
            ? {
                context: { slot: 10 },
                value: [
                  { address: "holder-a", amount: largest },
                  { address: "excluded", amount: "300" },
                ],
              }
            : { context: { slot: 10 }, value: { amount: "1000" } };
      return {
        status: 200,
        body: { jsonrpc: "2.0", id: value.id, result },
        receivedAt: observedAt,
      };
    },
  };
}

const identities = {
  createEvidenceId: () => asUuid<EvidenceId>("00000000-0000-4000-8000-000000009001"),
};

describe("Solana mint-security contract", () => {
  it("derives revoked authorities and holder concentration from two agreeing direct reads", async () => {
    const adapter = new SolanaMintSecurityAdapter(
      new SolanaRpcClient(transport()),
      new SolanaRpcClient(transport()),
      identities,
    );
    const result = await adapter.observe(mint, new Set(["excluded"]), observedAt);
    expect(result).toMatchObject({
      program: "spl_token",
      mintAuthority: "revoked",
      freezeAuthority: "revoked",
      directlyVerifiedOnChain: true,
    });
    expect(result.holders?.largestNormalPercentage.toString()).toBe("20");
    expect(result.evidence).toHaveLength(2);
  });

  it("rejects disagreement between independent holder reads", async () => {
    const adapter = new SolanaMintSecurityAdapter(
      new SolanaRpcClient(transport("200")),
      new SolanaRpcClient(transport("201")),
      identities,
    );
    await expect(adapter.observe(mint, new Set(), observedAt)).rejects.toThrow(/disagree/);
  });

  it("marks Token-2022 as an unapproved extension surface", async () => {
    const owner = "TokenzQdYqgP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
    const adapter = new SolanaMintSecurityAdapter(
      new SolanaRpcClient(transport("200", owner)),
      new SolanaRpcClient(transport("200", owner)),
      identities,
    );
    const result = await adapter.observe(mint, new Set(), observedAt);
    expect(result).toMatchObject({ program: "token_2022", extensions: ["unapproved"] });
  });
});
