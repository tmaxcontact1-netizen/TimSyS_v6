# Notifications and Communications component contract

Communications owns message content, reusable templates, recipient declarations, channel selection, the delivery outbox, read receipts and delivery history. Messages may link neutrally to records owned elsewhere through the standard subject reference.

`in_app` delivery is fulfilled locally and can truthfully become `delivered` and later `read`. Email, SMS and push recipients require an address and enter `queued` state. They never become delivered until a real provider adapter records provider acceptance; this phase intentionally configures no external adapter.

Draft messages are editable. Dispatch locks their content and recipient set. Withdrawal cancels undelivered recipients while retaining already delivered notifications and complete history. A withdrawn message can return to draft only when nothing was delivered.

Recipient parties are declared as `user`, `staff`, `student`, `guardian`, `team` or `external`. This component does not own profiles, audience expansion, consent preferences or provider credentials. Audience expansion will compose with the People and Audiences component in a later phase.

Template substitution is deliberately not performed implicitly. Consumers render and review final message content before creating a communication, ensuring stored and audited content is exactly what was dispatched.
