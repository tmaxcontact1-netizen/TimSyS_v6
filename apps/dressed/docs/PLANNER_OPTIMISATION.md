# Planner optimisation

The planner uses a deterministic daily greedy rotation over saved outfits in the requested context. It begins with styling quality (A = 100, B = 85, C = 70), then applies visible penalties when a complete outfit or constituent garment repeats inside the configured interval. Stable outfit IDs break equal scores, making identical inputs reproducible.

Each assignment becomes part of the working history before the next date is scored. This balances the whole requested range rather than independently choosing the strongest outfit every day. Fixed and excluded garments are hard filters. Grade C is excluded unless the selected policy permits it. If no saved outfit satisfies the hard filters, generation stops with an explicit `no_eligible_saved_outfits` result rather than inventing a plan.

The persisted explanation array records the styling starting point and every rotation penalty. Planned entries remain separate from wear events: skipping, moving, or replacing a plan does not modify garment wear counts.
