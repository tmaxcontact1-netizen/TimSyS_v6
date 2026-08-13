# Resource reservations contract

This component allocates quantities of items owned by `inventory`; it never copies or owns inventory data. Availability is the inventory quantity less overlapping requested, confirmed, or issued reservations. A reservation refers neutrally to its consumer. Returned reservations are immutable; withdrawal is reversible.
