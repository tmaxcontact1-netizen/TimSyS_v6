### Dashboard CRUD boundary

Persistent watchlist CRUD is an operator-preference capability, not execution authority. The local dashboard authenticates mutations with a dedicated high-entropy bearer token and exact origin verification. The token is supplied only through runtime environment configuration, is never served to the browser, stored in the database, or committed. Mutation routes cannot reach signer, swap, submission, risk-decision, or position-control adapters.

Persistent trading configurations are inert paper-mode drafts. Their API shares the watchlist authentication and origin boundary, enforces approved upper limits, uses optimistic concurrency, and records immutable mutation facts. No configuration can activate itself, change an approved strategy version, construct an execution adapter, or reach signing/submission paths.

The dashboard configuration editor reuses the session-only mutation credential. It displays and mutates inert drafts only, carries the current optimistic version on updates and deletion, reloads authoritative records after conflicts, and exposes no activation control.

The operator enters the mutation token into the loopback dashboard when changes are needed. The browser retains it only in page memory and clears the input immediately; it is never written to local storage. Persistent watchlist reads require no credential. Legacy browser-local token lists migrate only after an explicit operator action, and the local copy is cleared only after every durable, version-checked addition succeeds.
