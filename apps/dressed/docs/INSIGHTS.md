# Wardrobe insights

Dress'Ed insights are deterministic database calculations. They do not use an LLM, generative model, recommendation model, external fashion feed, or inferred personal characteristics.

- Wear count is the number of immutable wear events containing a garment.
- Cost per wear is purchase price divided by confirmed wear count; it is unavailable before first wear.
- Outfit versatility is the number of distinct saved outfits containing a garment.
- Rotation diversity is distinct confirmed outfits divided by total confirmed outfit wears.
- Underused and low-versatility prompts use visible user preferences.
- Care blockers and overdue cases come directly from unresolved care records.

These outputs are decision prompts, not decisions. The interface exposes the garments and formula context behind each prompt.
