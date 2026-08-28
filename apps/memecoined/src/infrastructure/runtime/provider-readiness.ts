import { z } from "zod";

import type { BoundedJsonHttpTransport } from "../providers/http-json.js";

const rpcEnvelope = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.number().int(),
  result: z.unknown().optional(),
  error: z.unknown().optional(),
});
const clusterGenesisHashes = Object.freeze({
  "mainnet-beta": "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
  devnet: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
});

export interface ProviderReadinessTarget {
  readonly primaryRpcUrl: string;
  readonly fallbackRpcUrl: string;
  readonly cluster: "mainnet-beta" | "devnet";
}

export interface ProviderReadinessReport {
  readonly cluster: "mainnet-beta" | "devnet";
  readonly primaryHost: string;
  readonly fallbackHost: string;
  readonly genesisHash: string;
  readonly primarySlot: number;
  readonly fallbackSlot: number;
  readonly slotDifference: number;
}

interface ProbeResult {
  readonly genesisHash: string;
  readonly slot: number;
}

async function rpc(
  transport: Pick<BoundedJsonHttpTransport, "post">,
  endpoint: string,
  id: number,
  method: string,
): Promise<unknown> {
  const response = await transport.post(endpoint, { jsonrpc: "2.0", id, method, params: [] });
  if (response.status < 200 || response.status >= 300)
    throw new Error(`Provider readiness ${method} returned HTTP ${response.status}`);
  const parsed = rpcEnvelope.safeParse(response.body);
  if (!parsed.success || parsed.data.id !== id || parsed.data.error !== undefined)
    throw new Error(`Provider readiness ${method} returned an invalid RPC response`);
  if (!("result" in parsed.data))
    throw new Error(`Provider readiness ${method} omitted its result`);
  return parsed.data.result;
}

async function probe(
  transport: Pick<BoundedJsonHttpTransport, "post">,
  endpoint: string,
  requestOffset: number,
): Promise<ProbeResult> {
  const health = await rpc(transport, endpoint, requestOffset + 1, "getHealth");
  if (health !== "ok") throw new Error("Provider readiness health response was not ok");
  const genesisHash = await rpc(transport, endpoint, requestOffset + 2, "getGenesisHash");
  if (typeof genesisHash !== "string" || genesisHash.length < 20)
    throw new Error("Provider readiness genesis hash was invalid");
  const slot = await rpc(transport, endpoint, requestOffset + 3, "getSlot");
  if (!Number.isSafeInteger(slot) || Number(slot) < 0)
    throw new Error("Provider readiness slot was invalid");
  return Object.freeze({ genesisHash, slot: Number(slot) });
}

/** Read-only connectivity proof. It cannot construct, sign, simulate, or submit transactions. */
export async function verifyProviderReadiness(
  target: ProviderReadinessTarget,
  transport: Pick<BoundedJsonHttpTransport, "post">,
  maximumSlotDifference = 500,
): Promise<ProviderReadinessReport> {
  if (!Number.isSafeInteger(maximumSlotDifference) || maximumSlotDifference < 0)
    throw new RangeError("Maximum provider slot difference must be a non-negative integer");
  const primaryUrl = new URL(target.primaryRpcUrl);
  const fallbackUrl = new URL(target.fallbackRpcUrl);
  if (primaryUrl.origin === fallbackUrl.origin)
    throw new Error("Provider readiness requires independent RPC origins");
  const [primary, fallback] = await Promise.all([
    probe(transport, target.primaryRpcUrl, 0),
    probe(transport, target.fallbackRpcUrl, 100),
  ]);
  if (primary.genesisHash !== fallback.genesisHash)
    throw new Error("RPC providers reported different Solana networks");
  if (primary.genesisHash !== clusterGenesisHashes[target.cluster])
    throw new Error("RPC providers do not match the configured Solana cluster");
  const slotDifference = Math.abs(primary.slot - fallback.slot);
  if (slotDifference > maximumSlotDifference)
    throw new Error("RPC providers exceed the permitted slot difference");
  return Object.freeze({
    cluster: target.cluster,
    primaryHost: primaryUrl.hostname,
    fallbackHost: fallbackUrl.hostname,
    genesisHash: primary.genesisHash,
    primarySlot: primary.slot,
    fallbackSlot: fallback.slot,
    slotDifference,
  });
}
