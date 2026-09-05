# Styling rule set 1.0.0

The initial rule set starts at 70 points and clamps the final result to 0–100. Default grades are A ≥ 85, B ≥ 72 and C ≥ 60. An ineligible ensemble has no grade regardless of score.

Hard rules currently require garment availability, a current visual fingerprint and compatibility with the selected context's formality range. Hard failures explain the problem and identify affected garments.

Soft rules cover:

- formality spread;
- dominant-colour separation using CIE Lab Delta-E distance;
- scale separation among visually active patterns;
- cumulative visual complexity;
- texture separation;
- direct tie/pocket-square colour and pattern duplication;
- requested-season suitability.

Each outcome contains its stable rule ID, domain, pass state, score delta, explanation code, deterministic rendered text, affected garment IDs and measurements. UI presentation separates strengths, cautions, major penalties and hard failures.

The rule laboratory evaluates a human-selected combination only. It does not generate, save or endorse an outfit. The ensemble engine reuses this exact contract when pruning and ranking generated combinations.
