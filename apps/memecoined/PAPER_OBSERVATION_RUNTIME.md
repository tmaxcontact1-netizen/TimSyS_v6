# Paper observation runtime

## Closed diagnostic epoch

Release `2026.09.25.7`, epoch 2, is a diagnostic epoch rather than a trading-performance window.
It established three defects: observation cadence was coupled to an unbounded sequential supervisor
pass; qualified watches could starve before reaching the pin threshold; and Oscillation Trader's
coverage gate was incompatible with the observation capacity allocated to the 64-token universe.

## Independent capacity

The observation timer ticks every 15 seconds. Four Oscillation Trader probe slots and four shared
qualified-watch slots are due every tick. Eight rotating slots are due every second tick. This is
48 attempts per minute: 16 OT probe, 16 watch and 16 rotating.

The four OT probes are split evenly: two stable-hash fairness probes and two sparse-volatility
responsive probes. A probe has a 30-minute tenure. At four observations per minute it receives 120
attempts in the 30-minute regime window and 80 across the minimum 20-minute coverage interval.
The 30-observation gate therefore remains reachable at a 25% call-success rate. Four probes cover
eight full probe windows per hour and the 64-token universe within eight hours.

Fast & Furious and Oscillation Trader share four watch slots. Higher regime score wins capacity;
equal scores prefer the most recently qualified watch, followed by deterministic profile and mint
ordering. Displacement removes dense capacity, not the durable watch record. Pin is a presentation
and retention state, not permission to collect sufficient evidence.

## Overload policy

At most 64 candidate attempts may wait for 16 workers. When full, the scheduler cancels rotating
work before OT probe work and OT probe work before watch work. A lower-or-equal-priority arrival is
itself cancelled rather than displacing higher-priority queued work. Every cancellation is persisted.
Provider calls receive one bounded retry. Queue size and scheduler cadence may not drift during
sustained overload; provider degradation must appear in cycle, attempt and provider-call telemetry.

## Evaluation discipline

A profile/token pair is evaluated only after a new observation fingerprint appears beyond its
persisted evaluation watermark. Insufficient data is neutral to a live qualification streak, but it
cannot generate repeated evaluations over identical evidence.

## Validation window

The next frozen paper window ends at 60 closed trades per evaluated profile or seven complete days,
whichever comes first. Parameters, profile definitions, provider configuration, starting balances
and allocations remain frozen. A profile that has not reached 60 trades at seven days is reported as
underpowered; its pass criteria are not weakened and its sample is not combined with another epoch.
