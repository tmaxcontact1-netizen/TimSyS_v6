-- Consolidate first-generation stored insights into the canonical product lifecycle.
INSERT OR IGNORE INTO insight_products (
    id, product_type, scope_type, scope_id, title, summary, explanation, evidence,
    knowledge_refs, possible_actions, confidence, uncertainty, severity, status,
    audience, provider_id, provider_version, detected_at, expires_at
)
SELECT
    id,
    CASE WHEN insight_type IN ('observation','alert','reminder','recommendation','data_quality')
         THEN insight_type ELSE 'observation' END,
    scope_type, scope_id, 'Migrated insight', summary,
    'Migrated from the first-generation TimSyS insight store.',
    '[{"kind":"legacy_insight","legacyId":"' || replace(id, '"', '') || '"}]',
    '[]', '[]', 0.5,
    'The original insight did not record structured confidence or provenance.',
    'information', 'detected', '[]', 'legacy.intelligence', '1.0.0',
    generated_at, expires_at
FROM intelligence_insights;

DROP TABLE intelligence_insights;
