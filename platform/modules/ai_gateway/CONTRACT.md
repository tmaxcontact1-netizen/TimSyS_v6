# AI Gateway service contract

The AI Gateway is a shared TimSyS backend consumable supporting OpenAI Responses, OpenAI-compatible Chat Completions, Anthropic Messages and a generic JSON webhook. Credentials remain encrypted in the launcher vault and are passed only to supervised backend processes.

Every request must contain bounded evidence with stable identifiers. Returned citations are rejected unless they reference supplied evidence. Results record provider, model, prompt version, evidence hash, confidence and limitations. AI output is advisory and cannot approve records, assign standards or overwrite deterministic evidence.
