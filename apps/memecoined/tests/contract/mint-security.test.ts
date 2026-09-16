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
  data = mintData,
): SolanaRpcTransport {
  return {
    post: async (request) => {
      const value = request as { id: number; method: string };
      const result =
        value.method === "getAccountInfo"
          ? {
              context: { slot: 10 },
              value: { data: [data.toString("base64"), "base64"], owner },
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

  it("uses the more conservative concentration when independent holder reads differ", async () => {
    const adapter = new SolanaMintSecurityAdapter(
      new SolanaRpcClient(transport("200")),
      new SolanaRpcClient(transport("201")),
      identities,
    );
    const result = await adapter.observe(mint, new Set(), observedAt);
    expect(result.holders?.largestNormalPercentage.toString()).toBe("20.1");
  });

  it("rejects disagreement about the mint's security configuration", async () => {
    const adapter = new SolanaMintSecurityAdapter(
      new SolanaRpcClient(transport()),
      new SolanaRpcClient(transport("200", "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb")),
      identities,
    );
    await expect(adapter.observe(mint, new Set(), observedAt)).rejects.toThrow(/disagree/);
  });

  it("identifies the unavailable independent provider without hiding the cause", async () => {
    const unavailable: SolanaRpcTransport = {
      post: async () => ({ status: 429, body: {}, receivedAt: observedAt }),
    };
    const adapter = new SolanaMintSecurityAdapter(
      new SolanaRpcClient(transport()),
      new SolanaRpcClient(unavailable),
      identities,
    );
    await expect(adapter.observe(mint, new Set(), observedAt)).rejects.toThrow(
      /Fallback RPC: Solana RPC is temporarily unavailable/,
    );
  });

  it("rejects impossible provider holder totals as non-retryable evidence", async () => {
    const adapter = new SolanaMintSecurityAdapter(
      new SolanaRpcClient(transport("1200")),
      new SolanaRpcClient(transport("1200")),
      identities,
    );
    await expect(adapter.observe(mint, new Set(), observedAt)).rejects.toMatchObject({
      retryable: false,
    });
  });

  it("rechecks an impossible confirmed holder total at finality without weakening the limit", async () => {
    const commitments: string[] = [];
    const skewed: SolanaRpcTransport = {
      post: async (request) => {
        const call = request as { id: number; method: string; params: readonly [string, { commitment: string }] };
        commitments.push(call.params[1].commitment);
        const result = call.method === "getAccountInfo"
          ? { context: { slot: 10 }, value: { data: [mintData.toString("base64"), "base64"], owner: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" } }
          : call.method === "getTokenLargestAccounts"
            ? { context: { slot: 10 }, value: [{ address: "holder-a", amount: call.params[1].commitment === "finalized" ? "200" : "1200" }] }
            : { context: { slot: 10 }, value: { amount: "1000" } };
        return { status: 200, body: { jsonrpc: "2.0", id: call.id, result }, receivedAt: observedAt };
      },
    };
    const adapter = new SolanaMintSecurityAdapter(
      new SolanaRpcClient(skewed), new SolanaRpcClient(skewed), identities,
    );
    const result = await adapter.observe(mint, new Set(), observedAt);
    expect(result.holders?.largestNormalPercentage.toString()).toBe("20");
    expect(commitments).toContain("finalized");
  });

  it("recognizes a Token-2022 mint with no extensions as verified", async () => {
    const owner = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
    const adapter = new SolanaMintSecurityAdapter(
      new SolanaRpcClient(transport("200", owner)),
      new SolanaRpcClient(transport("200", owner)),
      identities,
    );
    const result = await adapter.observe(mint, new Set(), observedAt);
    expect(result).toMatchObject({
      program: "token_2022",
      extensions: [],
      extensionsVerified: true,
    });
  });

  it("allows Token-2022 metadata while exposing dangerous transfer fees", async () => {
    const owner = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
    const extended = Buffer.alloc(166 + 4 + 64 + 4 + 108 + 4 + 12);
    mintData.copy(extended);
    extended[165] = 1;
    let offset = 166;
    for (const [type, length] of [
      [18, 64],
      [1, 108],
      [19, 12],
    ] as const) {
      extended.writeUInt16LE(type, offset);
      extended.writeUInt16LE(length, offset + 2);
      offset += 4 + length;
    }
    const adapter = new SolanaMintSecurityAdapter(
      new SolanaRpcClient(transport("200", owner, extended)),
      new SolanaRpcClient(transport("200", owner, extended)),
      identities,
    );
    const result = await adapter.observe(mint, new Set(), observedAt);
    expect(result).toMatchObject({ program: "token_2022", extensions: ["transfer_fee"] });
  });

  it("fails closed when a Token-2022 extension is not explicitly supported", async () => {
    const owner = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
    const extended = Buffer.alloc(171);
    mintData.copy(extended);
    extended[165] = 1;
    extended.writeUInt16LE(25, 166);
    extended.writeUInt16LE(1, 168);
    const adapter = new SolanaMintSecurityAdapter(
      new SolanaRpcClient(transport("200", owner, extended)),
      new SolanaRpcClient(transport("200", owner, extended)),
      identities,
    );
    const result = await adapter.observe(mint, new Set(), observedAt);
    expect(result).toMatchObject({ program: "token_2022", extensions: ["unapproved"] });
  });
});
