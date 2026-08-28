import { z } from "zod";

const schema = z
  .object({
    MEMECOINED_MODE: z.literal("supervised_live"),
    MEMECOINED_LOW_VALUE_TRIAL: z.literal("I_ACCEPT_LOW_VALUE_MAINNET_RISK"),
    MEMECOINED_TRIAL_APPROVAL_ID: z.string().regex(/^trial-[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9-]+$/),
    MEMECOINED_TRIAL_MAX_LAMPORTS: z.string().regex(/^[1-9][0-9]*$/),
    MEMECOINED_TRIAL_WALLET: z.string().min(32).max(44),
  })
  .passthrough();

export interface LowValueTrialAuthorization {
  readonly approvalId: string;
  readonly maximumLamports: bigint;
  readonly wallet: string;
}

/** Gates the manual mainnet proof. This does not itself sign, submit, or promote the runtime. */
export function authorizeLowValueTrial(environment: NodeJS.ProcessEnv): LowValueTrialAuthorization {
  const parsed = schema.safeParse(environment);
  if (!parsed.success) throw new Error("Low-value mainnet trial is not explicitly authorized");
  const maximumLamports = BigInt(parsed.data.MEMECOINED_TRIAL_MAX_LAMPORTS);
  if (maximumLamports > 10_000_000n)
    throw new Error("Low-value trial exceeds the hard 0.01 SOL ceiling");
  if (environment.CI !== undefined) throw new Error("Low-value mainnet trial is prohibited in CI");
  return Object.freeze({
    approvalId: parsed.data.MEMECOINED_TRIAL_APPROVAL_ID,
    maximumLamports,
    wallet: parsed.data.MEMECOINED_TRIAL_WALLET,
  });
}
