# Assessment Scales component contract

Assessment Scales owns versioned representations of individual evidence: points, percentages, letters, proficiency levels, pass/fail, and school-defined scales. It does not aggregate evidence, calculate course grades, or decide which evidence counts; those responsibilities belong to Evaluation Policies and Grade Evaluation.

Active scale versions are immutable. Changes create a new draft version so historical evidence always resolves against the scale used when it was recorded. Missing, incomplete, exempt, absent, late, not-assessed, and invalid are evidence states rather than scale levels and must never be hidden inside a numeric score.
