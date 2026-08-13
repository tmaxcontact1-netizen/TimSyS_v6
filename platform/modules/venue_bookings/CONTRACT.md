# Venue bookings contract

This component schedules rooms owned by `room_registry`; it never copies or owns room data. Active `requested` and `confirmed` bookings block overlapping windows. A booking refers neutrally to its consuming component and subject. Capacity is checked against expected attendance. Completed bookings are immutable; withdrawal is reversible.
