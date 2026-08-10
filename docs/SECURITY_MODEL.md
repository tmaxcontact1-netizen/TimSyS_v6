### Dashboard CRUD boundary

Persistent watchlist CRUD is an operator-preference capability, not execution authority. The local dashboard authenticates mutations with a dedicated high-entropy bearer token and exact origin verification. The token is supplied only through runtime environment configuration, is never served to the browser, stored in the database, or committed. Mutation routes cannot reach signer, swap, submission, risk-decision, or position-control adapters.
