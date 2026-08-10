### Dashboard CRUD boundary

Persistent watchlist CRUD is an operator-preference capability, not execution authority. The local dashboard authenticates mutations with a dedicated high-entropy bearer token and exact origin verification. The token is supplied only through runtime environment configuration, is never served to the browser, stored in the database, or committed. Mutation routes cannot reach signer, swap, submission, risk-decision, or position-control adapters.

The operator enters the mutation token into the loopback dashboard when changes are needed. The browser retains it only in page memory and clears the input immediately; it is never written to local storage. Persistent watchlist reads require no credential. Legacy browser-local token lists migrate only after an explicit operator action, and the local copy is cleared only after every durable, version-checked addition succeeds.
