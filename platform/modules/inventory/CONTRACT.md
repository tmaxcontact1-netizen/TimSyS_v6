# Inventory component contract

Inventory is the authoritative reusable register of physical items and available quantities. It owns item identity, classification, condition, quantity, assignment and checkout history.

Consuming modules reference inventory identifiers. Inventory does not own reservations, purchasing, budgets or people profiles. Its listed parts are internal building blocks, not independently deployable or observable components.
