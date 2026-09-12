# Standards Repository service contract

The Standards Repository is a shared Principal’Ed backend consumable, not a user-facing component. It stores immutable, versioned standards frameworks with publisher, jurisdiction, source-file and page provenance. Import errors are retained as reviewable issues; they are never silently discarded.

A framework cannot become active until every retained statement is verified and every blocking import issue is resolved or explicitly accepted with a recorded explanation. Activating a new version supersedes the prior active version without deleting it. Assessment Evaluator and the future Curriculum Evaluator consume active versions through stable statement identifiers.

The repository stores source authority. It does not infer curricular meaning, evaluate assessments or make professional decisions.
