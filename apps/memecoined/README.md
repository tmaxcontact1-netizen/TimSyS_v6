# MemeCoined’Ed

MemeCoined’Ed is an independently governed Solana market-observation and trading application supervised by the TimSyS desktop launcher. It is a decision and execution system with deliberately separate operating modes. Installing or starting the application does **not** authorize live trading.

## Supported operating modes

Promotion is linear: `historical → observation → shadow → paper → supervised_live → limited_auto → full_auto`. A deployment may move only one step at a time and only after the evidence in [PROMOTION_GATES.md](docs/PROMOTION_GATES.md) is signed off. Downgrading to a safer mode is always permitted.

| Mode              | Market data    | Decisions             | Simulated orders | Signed transactions                  |
| ----------------- | -------------- | --------------------- | ---------------- | ------------------------------------ |
| `historical`      | Recorded       | Yes                   | No               | Never                                |
| `observation`     | Live read-only | No execution decision | No               | Never                                |
| `shadow`          | Live read-only | Yes                   | Recorded only    | Never                                |
| `paper`           | Live read-only | Yes                   | Yes              | Never                                |
| `supervised_live` | Live           | Yes                   | No               | Human-approved only                  |
| `limited_auto`    | Live           | Yes                   | No               | Bounded automated execution          |
| `full_auto`       | Live           | Yes                   | No               | Prohibited until separately approved |

The Windows launcher currently supports the paper dashboard and supervised worker lifecycle. Real-money modes require a separate promotion decision and production deployment review.

## Development verification

Requirements are locked in [DEPENDENCY_MANIFEST.md](docs/DEPENDENCY_MANIFEST.md): Node.js 24.18.x, npm 11.9.x and PostgreSQL 18.4.

```text
npm ci
npm run verify:handoff
```

`verify:handoff` performs strict type checking, the complete automated test gate and a production TypeScript build. The normal suite deliberately excludes the manually gated low-value mainnet proof.

## Windows launcher setup for paper testing

For a controlled live-data preflight, run `npm run verify:providers`. This verifies the installation, schema and read-only agreement between the configured primary and fallback Solana RPC endpoints. It never constructs, signs, simulates or submits a transaction, and successful output is evidence only—not promotion authority.

1. Install TimSyS and open the MemeCoined tile.
2. On first launch, the launcher provisions a private local PostgreSQL cluster and writes a configuration template under its application-data directory.
3. Supply the six required paper fields in that generated `.env` file:
   - `SOLANA_PRIMARY_RPC_URL`
   - `SOLANA_FALLBACK_RPC_URL` from a genuinely independent provider
   - `HELIUS_API_KEY`
   - `JUPITER_API_KEY`
   - `PAPER_TRADING_WALLET_ADDRESS`
   - `PAPER_INITIAL_CASH_LAMPORTS`
   - `PAPER_EXECUTION_FEE_LAMPORTS` (optional; defaults to the declared 5,000-lamport simulation assumption)
4. Keep `MEMECOINED_MODE=paper`. Paper mode rejects signer and transaction-submission variables.
5. Restart from the launcher. Migrations run before the worker and dashboard are supervised.

Never place credentials, wallet secrets or provider responses in source control. The paper wallet address is observational; it must not be accompanied by a signer secret.

## Operator workflow

- Confirm the launcher reports both worker and dashboard as running.
- Confirm the dashboard reports `mode: paper` before using it.
- Treat recommendations and paper outcomes as evidence, not proof of future performance.
- Use the dashboard mutation token only for guarded paper controls; it is retained in page memory only.
- Stop the application immediately on stale authority, reconciliation disagreement, unexplained balance differences or repeated provider failure.
- Follow [OPERATIONS_RUNBOOK.md](docs/OPERATIONS_RUNBOOK.md) for startup, shutdown, incidents, backup and recovery.

## Safety boundary

Paper mode structurally excludes live execution configuration. Live execution additionally requires a permission-restricted signer file, exact transaction allowlists, fee ceilings, two independent RPC providers, human approval and the applicable promotion gate. No dashboard preference or trading configuration can activate live execution.

`supervised_live` also refuses startup without an explicit dated low-value-trial authorization, an exact trial wallet, and a per-entry ceiling no greater than 0.01 SOL. The signing wallet must match that authorization and every prepared entry is bounded by it. `limited_auto` and `full_auto` are deliberately rejected by this build; passing tests cannot activate unattended trading.
