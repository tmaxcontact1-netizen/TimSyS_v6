# Garment lifecycle and wear

A planned outfit is not evidence that it was worn. Only the explicit worn endpoint creates a `wear_event`, copies the saved outfit's garment membership into immutable event items, and changes the associated plan entry to `worn`. A database uniqueness constraint prevents duplicate wear confirmation for the same planned entry.

Care cases cover cleaning, repair, alteration and stains. The user chooses whether a case blocks availability; severe cases are not guessed by the application. Opening a blocking case marks the garment unavailable. Resolving it restores availability only if no other blocking case remains open.

Wear count, first worn, last worn and cost per wear are derived from wear-event evidence. Cost per wear is purchase price divided by confirmed wear count and remains unavailable, rather than misleadingly infinite, before first wear.
