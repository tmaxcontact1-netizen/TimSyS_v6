import { z } from "zod";

export const operatingModes = [
  "historical",
  "observation",
  "shadow",
  "paper",
  "supervised_live",
  "limited_auto",
  "full_auto",
] as const;
export type OperatingMode = (typeof operatingModes)[number];

const environmentSchema = z.enum(["development", "test", "production"]);
const logLevelSchema = z.enum(["debug", "info", "warn", "error", "fatal"]);
const httpsUrl = z
  .string()
  .url()
  .refine((value) => value.startsWith("https://"), "must use HTTPS");
const databaseUrl = z
  .string()
  .url()
  .refine(
    (value) => value.startsWith("postgres://") || value.startsWith("postgresql://"),
    "must be a PostgreSQL URI",
  );
const absolutePath = z.string().startsWith("/");
const nonempty = z.string().trim().min(1);

const schema = z
  .object({
    MEMECOINED_ENV: environmentSchema,
    MEMECOINED_MODE: z.enum(operatingModes),
    MEMECOINED_INSTANCE_ID: nonempty,
    MEMECOINED_LOG_LEVEL: logLevelSchema,
    MEMECOINED_CONFIG_DIR: absolutePath,
    DATABASE_URL: databaseUrl,
    SOLANA_PRIMARY_RPC_URL: httpsUrl.optional(),
    SOLANA_FALLBACK_RPC_URL: httpsUrl.optional(),
    SOLANA_CLUSTER: z.enum(["mainnet-beta", "devnet"]).optional(),
    HELIUS_API_KEY: nonempty.optional(),
    JUPITER_API_KEY: nonempty.optional(),
    PAPER_TRADING_WALLET_ADDRESS: nonempty.optional(),
    TRADING_WALLET_SECRET_FILE: absolutePath.optional(),
    TRANSACTION_ALLOWED_PROGRAM_IDS: nonempty.optional(),
    TRANSACTION_ALLOWED_FEE_RECIPIENTS: nonempty.optional(),
    TRANSACTION_ALLOWED_DESTINATIONS: nonempty.optional(),
    TRANSACTION_MAX_PRIORITY_FEE_LAMPORTS: z.string().regex(/^\d+$/).optional(),
  })
  .passthrough();

export interface RuntimeConfig {
  readonly environment: z.infer<typeof environmentSchema>;
  readonly mode: OperatingMode;
  readonly instanceId: string;
  readonly logLevel: z.infer<typeof logLevelSchema>;
  readonly configDirectory: string;
  readonly databaseUrl: string;
  readonly solana: null | Readonly<{
    primaryRpcUrl: string;
    fallbackRpcUrl: string;
    cluster: "mainnet-beta" | "devnet";
  }>;
  readonly paper: null | Readonly<{
    heliusApiKey: string;
    jupiterApiKey: string;
    walletAddress: string;
  }>;
  readonly execution: null | Readonly<{
    heliusApiKey: string;
    jupiterApiKey: string;
    walletSecretFile: string;
    allowedProgramIds: ReadonlySet<string>;
    allowedFeeRecipients: ReadonlySet<string>;
    allowedDestinationOwners: ReadonlySet<string>;
    maximumPrioritizationFeeLamports: bigint;
  }>;
}

const liveReads = new Set<OperatingMode>([
  "observation",
  "shadow",
  "paper",
  "supervised_live",
  "limited_auto",
  "full_auto",
]);
const liveExecution = new Set<OperatingMode>(["supervised_live", "limited_auto", "full_auto"]);

const liveExecutionOnlyVariables = [
  "TRADING_WALLET_SECRET_FILE",
  "TRANSACTION_ALLOWED_PROGRAM_IDS",
  "TRANSACTION_ALLOWED_FEE_RECIPIENTS",
  "TRANSACTION_ALLOWED_DESTINATIONS",
  "TRANSACTION_MAX_PRIORITY_FEE_LAMPORTS",
] as const;

function required(value: string | undefined, name: string): string {
  if (value === undefined) throw new Error(`${name} is required for the selected mode`);
  return value;
}

function requiredSet(value: string | undefined, name: string): ReadonlySet<string> {
  const items = required(value, name)
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (items.length === 0 || new Set(items).size !== items.length)
    throw new Error(`${name} must contain unique comma-separated values`);
  return new Set(items);
}

export function loadRuntimeConfig(environment: NodeJS.ProcessEnv): RuntimeConfig {
  const parsed = schema.safeParse(environment);
  if (!parsed.success)
    throw new Error(`Invalid runtime configuration: ${z.prettifyError(parsed.error)}`);
  const value = parsed.data;
  if (value.MEMECOINED_ENV === "production" && /localhost|127\.0\.0\.1/.test(value.DATABASE_URL))
    throw new Error("Production database cannot use a loopback host");
  const solana = liveReads.has(value.MEMECOINED_MODE)
    ? Object.freeze({
        primaryRpcUrl: required(value.SOLANA_PRIMARY_RPC_URL, "SOLANA_PRIMARY_RPC_URL"),
        fallbackRpcUrl: required(value.SOLANA_FALLBACK_RPC_URL, "SOLANA_FALLBACK_RPC_URL"),
        cluster: required(value.SOLANA_CLUSTER, "SOLANA_CLUSTER") as "mainnet-beta" | "devnet",
      })
    : null;
  if (solana !== null && new URL(solana.primaryRpcUrl).host === new URL(solana.fallbackRpcUrl).host)
    throw new Error("Primary and fallback Solana RPC providers must be independent");
  const paper =
    value.MEMECOINED_MODE === "paper"
      ? Object.freeze({
          heliusApiKey: required(value.HELIUS_API_KEY, "HELIUS_API_KEY"),
          jupiterApiKey: required(value.JUPITER_API_KEY, "JUPITER_API_KEY"),
          walletAddress: required(
            value.PAPER_TRADING_WALLET_ADDRESS,
            "PAPER_TRADING_WALLET_ADDRESS",
          ),
        })
      : null;
  if (paper !== null && liveExecutionOnlyVariables.some((name) => environment[name] !== undefined))
    throw new Error("Paper mode forbids signer secrets and transaction-submission policy");
  const execution = liveExecution.has(value.MEMECOINED_MODE)
    ? Object.freeze({
        heliusApiKey: required(value.HELIUS_API_KEY, "HELIUS_API_KEY"),
        jupiterApiKey: required(value.JUPITER_API_KEY, "JUPITER_API_KEY"),
        walletSecretFile: required(value.TRADING_WALLET_SECRET_FILE, "TRADING_WALLET_SECRET_FILE"),
        allowedProgramIds: requiredSet(
          value.TRANSACTION_ALLOWED_PROGRAM_IDS,
          "TRANSACTION_ALLOWED_PROGRAM_IDS",
        ),
        allowedFeeRecipients: requiredSet(
          value.TRANSACTION_ALLOWED_FEE_RECIPIENTS,
          "TRANSACTION_ALLOWED_FEE_RECIPIENTS",
        ),
        allowedDestinationOwners: requiredSet(
          value.TRANSACTION_ALLOWED_DESTINATIONS,
          "TRANSACTION_ALLOWED_DESTINATIONS",
        ),
        maximumPrioritizationFeeLamports: BigInt(
          required(
            value.TRANSACTION_MAX_PRIORITY_FEE_LAMPORTS,
            "TRANSACTION_MAX_PRIORITY_FEE_LAMPORTS",
          ),
        ),
      })
    : null;
  return Object.freeze({
    environment: value.MEMECOINED_ENV,
    mode: value.MEMECOINED_MODE,
    instanceId: value.MEMECOINED_INSTANCE_ID,
    logLevel: value.MEMECOINED_LOG_LEVEL,
    configDirectory: value.MEMECOINED_CONFIG_DIR,
    databaseUrl: value.DATABASE_URL,
    solana,
    paper,
    execution,
  });
}
