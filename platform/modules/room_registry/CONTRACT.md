# Room manifest component contract

Room manifest is the authoritative reusable register of places. It owns room identity, building description, type, capacity, facilities, availability state and direct booking history.

Scheduling components reference room identifiers without copying room ownership. Its listed parts are descriptive internals with no independent lifecycle, telemetry or insight contract.
