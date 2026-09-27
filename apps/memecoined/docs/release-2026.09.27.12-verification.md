# Release 2026.09.27.12 candidate verification

Status: implemented locally; not committed, published, or used to create an epoch.

## Epoch .11 disposition

Epoch database id 7 was terminated as `diagnostic` at 2026-09-27 19:16:08.723416 +03:00.
Its reason is the pre-authorized zero-admission diagnosis. The worker was stopped. No epoch .12
exists. All epoch-scoped evaluation evidence remains queryable by the database administrator.
One position opened during the guarded termination check and closed normally before termination;
it was archived as a clean Oscillation Trader hard-stop trade. No position or open intent remains.

## Candidate changes

- Extreme-oversold admission now requires both a recent oversold-to-reversal transition and a
  still-valid current state: RSI <= 35, z-score <= -1, positive latest return, and buy pressure
  absent or >= 48%. Admission recalculates this state from the current 30-minute executable quote
  history before requesting the sized entry quote.
- The transition's exact observation timestamp and executable output amount are persisted in the
  immutable signal metrics as `reversalOnsetObservedAt` and `reversalOnsetOutputAmountRaw`.
- Close-out MFE/MAE now reads only `paper_profile_position_quote_paths.return_bps`, scoped by epoch,
  wallet, profile, token, and the position's open interval. It no longer mixes fixed 0.01 SOL
  observations with position-sized quotes.
- Managed PostgreSQL pool acquisition retries only transient acquisition/restart errors, using
  bounded exponential backoff (250, 500, 1000, 2000 ms; five attempts; 15-second total ceiling).
  SQL and validation errors are not retried.
- The remaining unbounded completed-dispatch cache found by the memory audit is now capped at
  2,048 entries. Rejection events (2,048), accepted Jupiter quotes (1,024), observation queue (64),
  deferred observations, and scheduler promises were confirmed bounded or removed on completion.

## Archived evidence analyses

### Jupiter HTTP 400

Epoch .11 contains 751 HTTP 400 calls across exactly 12 token mints. Every sampled error has the
same provider category: `The token <mint> is not tradable`. This is repeated probing of unsupported
or delisted Jupiter routes. It is not malformed query construction and not general provider
incompatibility. There were 23 HTTP 429 calls among 2,707 provider calls.

### Security evidence staleness

Of 583 Fast & Furious signals, 2 were rejected for evidence older than 15 minutes; both had a
non-null trigger. Of 583 Oscillation Trader signals, 2 had the staleness reason, but none had a
confirmed entry trigger. Security refresh cadence was therefore measurable but was not the primary
zero-admission choke point.

### Memory

The audit confirmed the previously fixed bounds are active on the paper path. It also found an
unbounded completed-action map in the production dispatcher; the release candidate caps it. The
observed 33 MB increase cannot be attributed to that dispatcher during paper mode, so it remains a
runtime-soak measurement rather than a proven paper-path leak.

### Dashboard `Failed to fetch`

The browser refreshes `/api/focused-dashboard` and `/api/trading-profiles` concurrently every 30
seconds. The current client reports the native `TypeError: Failed to fetch` only when one of those
requests cannot reach the dashboard HTTP process; an HTTP 503 is instead replaced with the app's
own `The paper-trading records could not be loaded` message. Request-level access telemetry does
not exist, so the archived evidence cannot attribute the native failure to one of the two endpoints
or count individual failures. At most two requests per 30-second refresh were exposed.

The durable dashboard log records a fresh listener at 2026-09-27 18:27:40 +03:00. PostgreSQL was
also unavailable from 17:19:37 to 17:31:22. The prior instrumented worker's fatal pool-acquisition
incident was recorded at 17:06:22. No dashboard request/error log survived for 17:06-18:27, so a
fine-grained correlation with partial cycles or provider bursts is not measurable. The available
evidence is consistent with the dashboard process/listener being absent during that outage rather
than an endpoint-specific query failure. No post-recovery `Failed to fetch` event is present in the
durable logs, but absence cannot prove zero occurrences because browser fetch errors are not
persisted server-side.

The dashboard and worker are separate Node processes, so they do not share an event loop or a
`pg.Pool`. Each owns an independent pool of up to six connections. They do share the same managed
PostgreSQL instance, and `/api/focused-dashboard` launches four database reads concurrently while
the browser also requests `/api/trading-profiles`. Dashboard reads can therefore contend for
database connection/IO capacity with observation and execution, even though JavaScript execution
is isolated. A .12 separation candidate is to give dashboard traffic a lower, bounded connection
budget plus request latency/status telemetry; physical database separation is not justified by the
current evidence.

## Verification evidence

- TypeScript typecheck: pass.
- Full MemeCoin'Ed suite: 140 files, 806 tests passed.
- Epoch .10 replay regression: all five supplied rapid-stop current states (RSI 55-78, z-score
  -0.2 to +2.6) reject; GTBxUi's supplied state (RSI 18.8, z-score -1.63) remains admissible.
- Production-cadence cold start: empty stores progress through discovery, security, probe, watch,
  and entry eligibility; both one-token and 50-token fixtures remain within the <=2x scaling bound.
- 60-minute 48-attempt/minute soak at 30% injected loss: 2,880 scheduled, 2,614 observations,
  43.57 observations/minute, maximum queue depth 10/64, zero cancellations, zero final depth.
- The same soak at 75% loss: 983 observations, 16.38/minute, maximum depth 59/64, 646 low-priority
  cancellations, zero final depth. Each OT probe retained 49-59 observations in the first 30
  minutes, exceeding the 30-observation gate.
- Transient pool regression: two successive acquisition/restart failures recover on attempt three;
  non-transient SQL failure is attempted once and propagated.

## Publication boundary

This candidate has not been committed or published. Epoch .12 has not been created. A real
managed-PostgreSQL stop/start verification would cause runtime state changes and is intentionally
held until publication/start authorization; the deterministic acquisition-failure regression is
the pre-publication gate.
