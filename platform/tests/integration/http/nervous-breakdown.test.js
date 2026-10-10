'use strict';
const helper = require('../../helpers/test-server');
describe('Nervous Breakdown governed source-to-trail workflow', () => {
  let context, token, document, version;
  const request = (method, url, body) => context.makeRequest(method, url, body, token);
  const row = (id, kind, data) => ({ id, kind, expected_revision: 0, data });
  const batch = records => request('POST', '/nervous-breakdown/import', { format: 'timsys.nervous-breakdown.v1', records, reason: 'Synthetic integration fixture', confirm_review: true });
  const fixture = () => [
    row('test-role', 'role', { name: 'Test role', mapping_state: 'mapped', status: 'active', is_fixture: true }),
    row('test-source', 'source', { name: 'Test JD', source_type: 'job_description', version_label: '2026–27', role_id: 'test-role', document_id: document.id, document_version_id: version.id, status: 'active', is_fixture: true }),
    row('test-statement', 'statement', { source_id: 'test-source', original_text: 'Record concerns and report them for review.', location: 'paragraph 1', review_status: 'reviewed', status: 'active', is_fixture: true }),
    row('test-link-type', 'term', { name: 'Reports to', category: 'relationship_type', definition: 'Passes recorded information for review', status: 'active', is_fixture: true }),
    ...['a', 'b', 'orphan'].map(id => row('test-' + id, 'responsibility', { name: 'Synthetic responsibility ' + id, normalized_statement: id === 'a' ? 'Record concerns' : 'Review concerns', role_id: 'test-role', statement_id: 'test-statement', statement_revision: 1, domain_ids: [], responsibility_type_ids: [], authority_type_ids: [], review_status: 'reviewed', status: 'active', is_fixture: true })),
    row('test-edge', 'connection', { from_id: 'test-a', to_id: 'test-b', relationship_type_id: 'test-link-type', evidence: 'proposed', review_status: 'reviewed', status: 'active', is_fixture: true }),
  ];
  beforeAll(async () => {
    context = await helper.createTestServer('nervous_breakdown');
    token = (await context.makeRequest('POST', '/api/auth/dev-login', {})).data.token;
    document = (await request('POST', '/documents', { title: 'Synthetic JD' })).data.document;
    version = (await request('POST', `/documents/${document.id}/versions`, { filename: 'fixture.txt', mime_type: 'text/plain', content_base64: Buffer.from('Record concerns and report them for review.').toString('base64') })).data.document.versions[0];
  });
  afterAll(async () => { if (context) await context.cleanup(); });
  test('working runtime refuses synthetic imports without saving any rows', async () => {
    const previous = process.env.NODE_ENV;
    const before = (await request('GET', '/nervous-breakdown/workspace')).data.records.length;
    try {
      process.env.NODE_ENV = 'production';
      const response = await batch([row('working-runtime-fixture', 'role', { name: 'Isolated test role', mapping_state: 'referenced', is_fixture: true })]);
      expect(response.status).toBe(400);
      expect(response.data.report.errors.some(error => error.code === 'TEST_DATA_NOT_ALLOWED')).toBe(true);
      expect((await request('GET', '/nervous-breakdown/workspace')).data.records).toHaveLength(before);
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
  test('imports one source statement with multiple responsibilities, then traverses a directed trail', async () => {
    const imported = await batch(fixture()); expect(imported.status).toBe(200); expect(imported.data.records).toHaveLength(8);
    const result = await request('GET', '/nervous-breakdown/graph?fixtures=true&selected=test-a&direction=downstream&depth=1');
    expect(result.data.nodes).toHaveLength(3); expect(result.data.trail.nodes).toEqual(['test-a', 'test-b']);
    expect(result.data.trail.nodes).not.toContain('test-orphan');
    expect(result.data.edges[0].data.evidence).toBe('proposed');
    expect((await request('GET', '/nervous-breakdown/graph')).data.nodes).toHaveLength(0);
    expect((await request('GET', '/nervous-breakdown/graph?fixtures=true&selected=test-a&direction=upstream')).data.trail.nodes).toEqual(['test-a']);
  });
  test('invalid batches are atomic and cannot manufacture documentary connections', async () => {
    const before = (await request('GET', '/nervous-breakdown/workspace')).data.records.length;
    const response = await batch([row('must-not-save', 'role', { name: 'Do not save', mapping_state: 'referenced' }), row('bad-edge', 'connection', { from_id: 'test-a', to_id: 'test-b', relationship_type_id: 'test-link-type', evidence: 'documentary', review_status: 'proposed', is_fixture: true })]);
    expect(response.status).toBe(400); expect(response.data.error.message).toContain('source evidence');
    expect((await request('GET', '/nervous-breakdown/workspace')).data.records).toHaveLength(before);
  });
  test('lightweight topology and pinned detail are read-only projections through registered routes', async () => {
    const before=(await request('GET','/nervous-breakdown/export')).data;
    const topology=await request('GET','/nervous-breakdown/topology?fixtures=true');
    expect(topology.status).toBe(200);expect(topology.data.nodes).toHaveLength(3);
    expect(topology.data.nodes[0].data).not.toHaveProperty('notes');
    expect(topology.data.nodes[0].data).not.toHaveProperty('operational_ownership_id');
    expect(topology.data.gaps).toEqual([]);
    const detail=await request('GET','/nervous-breakdown/records/test-a/detail?fixtures=true');
    expect(detail.status).toBe(200);expect(detail.data.statement.data.original_text).toBe('Record concerns and report them for review.');
    expect(detail.data.source.data.document_version_id).toBe(version.id);
    const after=(await request('GET','/nervous-breakdown/export')).data;
    expect(after.records).toEqual(before.records);expect(after.history).toEqual(before.history);
  });
  test('source-statement edits retain the exact revision cited by existing responsibilities', async () => {
    const statement = (await request('GET', '/nervous-breakdown/workspace')).data.records.find(r => r.id === 'test-statement');
    const response = await request('POST', '/nervous-breakdown/records', { reason: 'Correction of reviewed transcription', confirm_review: true, record: { id: statement.id, kind: statement.kind, expected_revision: 1, data: { ...statement.data, original_text: 'Corrected transcription' } } });
    expect(response.status).toBe(200);
    const history = (await request('GET', '/nervous-breakdown/records/test-statement/history')).data.history;
    expect(history).toHaveLength(2); expect(history[0].snapshot.data.original_text).toBe('Record concerns and report them for review.');
    const node = (await request('GET', '/nervous-breakdown/workspace')).data.records.find(r => r.id === 'test-a');
    expect(node.data.statement_revision).toBe(1);
    const saveNode = await request('POST', '/nervous-breakdown/records', { reason: 'Wording refinement', confirm_review: true, record: { id: node.id, kind: node.kind, expected_revision: node.revision, data: { ...node.data, name: 'Revised display label' } } });
    expect(saveNode.status).toBe(200);
  });
  test('stale writes, source replacement, fixture promotion and supersession cycles are rejected', async () => {
    const records = (await request('GET', '/nervous-breakdown/workspace')).data.records;
    const node = records.find(r => r.id === 'test-a');
    const save = data => request('POST', '/nervous-breakdown/records', { reason: 'Validation test', confirm_review: true, record: data });
    expect((await save({ ...node, expected_revision: 0 })).status).toBe(409);
    expect((await save({ ...node, expected_revision: node.revision, data: { ...node.data, is_fixture: false } })).status).toBe(400);
    expect((await save({ ...node, expected_revision: node.revision, data: { ...node.data, status: 'superseded', superseded_by: node.id } })).status).toBe(400);
    const source = records.find(r => r.kind === 'source');
    expect((await save({ ...source, expected_revision: source.revision, data: { ...source.data, document_version_id: 999999 } })).status).toBe(400);
  });
  test('source integrity and review confirmation are enforced', async () => {
    const source = fixture().find(r => r.kind === 'source'); source.id = 'wrong-digest'; source.data.document_sha256 = 'invalid';
    expect((await batch([source])).data.error.message).toContain('digest');
    const r = fixture().find(r => r.id === 'test-a'); r.id = 'unreviewed';
    const response = await request('POST', '/nervous-breakdown/records', { record: r, reason: 'Missing confirmation' });
    expect(response.status).toBe(400); expect(response.data.error.message).toContain('human review');
  });
  test('exports historical evidence and preserves immutable original file content', async () => {
    const exported = await request('GET', '/nervous-breakdown/export');
    expect(exported.data.format).toBe('timsys.nervous-breakdown.v1'); expect(exported.data.history.length).toBeGreaterThan(exported.data.records.length);
    const content = await request('GET', `/documents/${document.id}/versions/${version.id}/content`);
    expect(Buffer.from(content.data.contentBase64, 'base64').toString()).toBe('Record concerns and report them for review.');
  });
  test('requires authentication and rejects unsupported scope and malformed records', async () => {
    expect((await context.makeRequest('GET', '/nervous-breakdown/workspace')).status).toBe(401);
    expect((await request('GET', '/nervous-breakdown/workspace?app_id=other')).status).toBe(400);
    expect((await batch([null])).status).toBe(400);
    const response = await batch([row('bad-date', 'role', { name: 'Test', mapping_state: 'placeholder', effective_from: '2026-99-99' })]);
    expect(response.status).toBe(400);
  });
  test('document readers cannot govern the organisation and organisational viewers cannot write', async () => {
    const jwt = require('jsonwebtoken');
    for (const permissions of [['admin:documents:read'], ['admin:nervous_breakdown:read']]) {
      const reader = jwt.sign({ userId: 'test-reader', permissions }, process.env.JWT_SECRET, { expiresIn: '1h' });
      const result = await context.makeRequest('POST', '/nervous-breakdown/records', { reason: 'Must fail', record: row('permission-denied', 'role', { name: 'Denied', mapping_state: 'placeholder' }) }, reader);
      expect(result.status).toBe(403);
    }
  });
  test('governance draft review exposes synthetic inferred/proposed edges without approval or writes', async () => {
    const synthetic = [
      ...['a', 'b'].map(id => row('draft-review-' + id, 'responsibility', { name: 'Draft review synthetic ' + id, normalized_statement: 'Synthetic review ' + id, role_id: 'test-role', statement_id: 'test-statement', statement_revision: 1, status: 'draft', review_status: 'draft', evidence: 'documentary', is_fixture: true })),
      ...['inferred', 'proposed'].map(evidence => row('draft-review-' + evidence, 'connection', { from_id: 'draft-review-a', to_id: 'draft-review-b', relationship_type_id: 'test-link-type', direction: 'from_to', evidence, review_status: 'draft', status: 'draft', notes: JSON.stringify({ Rationale: 'Synthetic hypothesis only', 'Direction Review': 'unreviewed' }), is_fixture: true })),
    ];
    expect((await batch(synthetic)).status).toBe(200);
    const before = (await request('GET', '/nervous-breakdown/export')).data;
    const normalBefore = (await request('GET', '/nervous-breakdown/graph?fixtures=true')).data;
    expect(normalBefore.edges.some(e => e.id.startsWith('draft-review-'))).toBe(false);
    const review = await request('GET', '/nervous-breakdown/graph?fixtures=true&mode=draft_review&selected=draft-review-a&depth=1');
    expect(review.status).toBe(200); expect(review.data.mode).toBe('draft_review');
    expect(review.data.trail.nodes).toEqual(['draft-review-a', 'draft-review-b']);
    for (const evidence of ['inferred', 'proposed']) {
      const edge = review.data.edges.find(e => e.id === 'draft-review-' + evidence);
      expect(edge.data).toMatchObject({ evidence, status: 'draft', review_status: 'draft', from_id: 'draft-review-a', to_id: 'draft-review-b' });
      expect(JSON.parse(edge.data.notes).Rationale).toBe('Synthetic hypothesis only');
    }
    expect((await request('GET', '/nervous-breakdown/workspace')).data.can_draft_review).toBe(true);
    const jwt = require('jsonwebtoken');
    const reader = jwt.sign({ userId: 'draft-review-reader', permissions: ['admin:nervous_breakdown:read'] }, process.env.JWT_SECRET, { expiresIn: '1h' });
    expect((await context.makeRequest('GET', '/nervous-breakdown/graph?mode=draft_review', undefined, reader)).status).toBe(403);
    expect((await context.makeRequest('GET', '/nervous-breakdown/workspace', undefined, reader)).data.can_draft_review).toBe(false);
    expect((await context.makeRequest('GET', '/nervous-breakdown/graph', undefined, reader)).status).toBe(200);
    expect((await request('GET', '/nervous-breakdown/graph?mode=approve')).status).toBe(400);
    const after = (await request('GET', '/nervous-breakdown/export')).data;
    expect(after.records).toEqual(before.records); expect(after.history).toEqual(before.history);
    const normalAfter = (await request('GET', '/nervous-breakdown/graph?fixtures=true')).data;
    expect(normalAfter.nodes).toEqual(normalBefore.nodes); expect(normalAfter.edges).toEqual(normalBefore.edges); expect(normalAfter.trail).toEqual(normalBefore.trail);
  });
  test('new ontology, subdomains, null classifications and directed evidence survive an idempotent export/import', async () => {
    const before = (await request('GET', '/nervous-breakdown/workspace')).data;
    expect(before.ontology.terms).toEqual([]); // Synthetic terms are never organisational vocabulary.
    expect(before.import_schema.$defs.responsibility).toBeDefined();
    const terms = [
      row('test-domain', 'term', { name: 'Synthetic domain', category: 'domain', definition: null, is_fixture: true, status: 'active' }),
      row('test-subdomain', 'term', { name: 'Synthetic subdomain', category: 'domain', parent_id: 'test-domain', definition: 'Synthetic child', is_fixture: true, status: 'active' }),
      row('test-action', 'term', { name: 'Synthetic action', category: 'responsibility_type', definition: 'Synthetic only', is_fixture: true, status: 'active' }),
      row('test-authority', 'term', { name: 'Synthetic authority', category: 'authority_type', definition: 'Synthetic only', is_fixture: true, status: 'active' }),
    ];
    const a = before.records.find(r => r.id === 'test-a'), b = before.records.find(r => r.id === 'test-b');
    const records = [...terms,
      { ...a, expected_revision: a.revision, data: { ...a.data, domain_ids: ['test-domain', 'test-subdomain'], responsibility_type_ids: ['test-action'], authority_type_ids: ['test-authority'], level: null } },
      { ...b, expected_revision: b.revision, data: { ...b.data, domain_ids: null, responsibility_type_ids: null, authority_type_ids: null, level: null } },
      row('test-explicit-edge', 'connection', { from_id: a.id, to_id: b.id, direction: 'from_to', relationship_type_id: 'test-link-type', statement_id: 'test-statement', statement_revision: 1, evidence: 'documentary', review_status: 'reviewed', status: 'active', notes: 'Synthetic only', is_fixture: true }),
      row('test-unresolved-edge', 'connection', { from_id: b.id, to_id: a.id, direction: 'from_to', relationship_type_id: null, evidence: 'unresolved', review_status: 'proposed', status: 'draft', is_fixture: true }),
    ];
    const preflight = await request('POST', '/nervous-breakdown/import', { format: 'timsys.nervous-breakdown.v1', records, reason: 'Synthetic preflight', dry_run: true });
    expect(preflight.status).toBe(200); expect(preflight.data.report.valid).toBe(true);
    expect(preflight.data.report.warnings.map(w => w.code)).toEqual(expect.arrayContaining(['UNRESOLVED_CLASSIFICATION', 'UNRESOLVED_RELATIONSHIP', 'MISSING_DEFINITION']));
    expect((await request('GET', '/nervous-breakdown/workspace')).data.records).toEqual(before.records);
    expect((await batch(records)).status).toBe(200);
    const graphBefore = (await request('GET', '/nervous-breakdown/graph?fixtures=true&selected=test-a&direction=downstream&depth=1')).data;
    expect(graphBefore.edges.find(r => r.id === 'test-explicit-edge').data.direction).toBe('from_to');
    expect(graphBefore.nodes.find(r => r.id === b.id).data.domain_ids).toBeNull();
    const exported = (await request('GET', '/nervous-breakdown/export')).data;
    const imported = await request('POST', '/nervous-breakdown/import', { ...exported, reason: 'Synthetic exported package replay', confirm_review: true });
    expect(imported.status).toBe(200); expect(imported.data.report.counts.changes).toBe(0);
    expect(imported.data.report.counts.unchanged).toBe(exported.records.length);
    const again = (await request('GET', '/nervous-breakdown/export')).data;
    expect(again.records).toEqual(exported.records); expect(again.history).toEqual(exported.history);
    const graphAfter = (await request('GET', '/nervous-breakdown/graph?fixtures=true&selected=test-a&direction=downstream&depth=1')).data;
    for (const field of ['nodes', 'edges', 'trail']) expect(graphAfter[field]).toEqual(graphBefore[field]);
    const bytes = await request('GET', `/documents/${document.id}/versions/${version.id}/content`);
    expect(Buffer.from(bytes.data.contentBase64, 'base64').toString()).toBe('Record concerns and report them for review.');
  });
  test('aggregates blocking integrity errors without saving any row or silently fixing unknown data', async () => {
    const before = (await request('GET', '/nervous-breakdown/export')).data;
    const records = [
      row('duplicate-id', 'role', { name: 'Synthetic', mapping_state: 'placeholder', is_fixture: true }),
      row('duplicate-id', 'role', { name: 'Synthetic other', mapping_state: 'placeholder', is_fixture: true }),
      row('missing-links', 'responsibility', { name: 'Synthetic invalid', normalized_statement: 'Synthetic only', role_id: 'missing-role', statement_id: 'missing-source-statement', statement_revision: 1, domain_ids: ['missing-term'], review_status: 'proposed', is_fixture: true }),
      row('invalid-edge', 'connection', { from_id: 'missing-a', to_id: 'missing-b', relationship_type_id: 'test-domain', evidence: 'proposed', review_status: 'proposed', is_fixture: true }),
      row('reversed-dates', 'role', { name: 'Synthetic', mapping_state: 'placeholder', effective_from: '2027-01-01', effective_to: '2026-01-01', is_fixture: true }),
      row('wrong-version', 'source', { name: 'Synthetic source', source_type: 'job_description', role_id: 'test-role', document_id: document.id, document_version_id: 999999, version_label: 'Invalid', is_fixture: true }),
    ];
    for (const dry_run of [true, false]) {
      const result = await request('POST', '/nervous-breakdown/import', { format: 'timsys.nervous-breakdown.v1', records, reason: 'Must reject', dry_run });
      expect(result.status).toBe(400); expect(result.data.report.valid).toBe(false);
      expect(result.data.report.errors.map(e => e.code)).toEqual(expect.arrayContaining(['DUPLICATE_ID', 'UNKNOWN_REFERENCE', 'UNKNOWN_ONTOLOGY_TERM', 'INVALID_RELATIONSHIP_TYPE']));
      expect(result.data.report.errors.map(e => e.record_id)).toEqual(expect.arrayContaining(['wrong-version', 'reversed-dates']));
    }
    const after = (await request('GET', '/nervous-breakdown/export')).data;
    expect(after.records).toEqual(before.records); expect(after.history).toEqual(before.history);
  });
  test('reports possible duplicates and date ambiguity as warnings; rejects string dry_run bypass', async () => {
    const node = (await request('GET', '/nervous-breakdown/workspace')).data.records.find(r => r.id === 'test-b');
    const result = await batch([{ ...node, id: 'test-possible-duplicate', expected_revision: 0 }]);
    expect(result.status).toBe(200);
    expect(result.data.report.warnings.some(w => w.code === 'POSSIBLE_DUPLICATE')).toBe(true);
    const role = (await request('GET', '/nervous-breakdown/workspace')).data.records.find(r => r.id === 'test-role');
    const dates = await request('POST', '/nervous-breakdown/import', { format: 'timsys.nervous-breakdown.v1', reason: 'Synthetic date ambiguity', dry_run: true, records: [
      { ...role, expected_revision: role.revision, data: { ...role.data, effective_to: '2020-01-01' } },
      { ...node, id: 'future-record', expected_revision: 0, data: { ...node.data, effective_from: '2030-01-01' } },
    ] });
    expect(dates.status).toBe(200);
    expect(dates.data.report.warnings.some(w => w.code === 'EFFECTIVE_DATE_REVIEW')).toBe(true);
    expect((await request('POST', '/nervous-breakdown/import', { format: 'timsys.nervous-breakdown.v1', records: [row('bypass', 'statement', { source_id: 'test-source', original_text: 'Synthetic', location: '1', review_status: 'reviewed', is_fixture: true })], reason: 'Must fail', dry_run: 'true' })).status).toBe(400);
  });
  test('preflight supports a dataset larger than the default one MiB request cap without writing', async () => {
    const records = [row('test-large-preflight', 'role', { name: 'Synthetic large import', mapping_state: 'placeholder', is_fixture: true, notes: 'x'.repeat(1100000) })];
    const response = await request('POST', '/nervous-breakdown/import', { format: 'timsys.nervous-breakdown.v1', records, reason: 'Synthetic request-size check', dry_run: true });
    expect(response.status).toBe(200);
    expect((await request('GET', '/nervous-breakdown/workspace')).data.records.some(r => r.id === 'test-large-preflight')).toBe(false);
  });
  test('draft reviewed-state vocabulary preserves independent evidence, governed levels and hierarchy on replay', async () => {
    const records = [
      row('test-level', 'term', { name: 'Synthetic governed level', category: 'responsibility_level', status: 'draft', is_fixture: true }),
      row('test-other-domain', 'term', { name: 'Other synthetic domain', category: 'domain', is_fixture: true }),
      row('test-general-a', 'term', { name: 'General', category: 'domain', parent_id: 'test-domain', is_fixture: true }),
      row('test-general-b', 'term', { name: 'General', category: 'domain', parent_id: 'test-other-domain', is_fixture: true }),
      row('test-draft-responsibility', 'responsibility', { name: 'Draft analytical fixture', normalized_statement: 'Synthetic only', role_id: 'test-role', statement_id: 'test-statement', statement_revision: 1, level_id: 'test-level', level: null, evidence: 'documentary', review_status: 'draft', status: 'draft', is_fixture: true }),
      ...['documentary', 'inferred', 'proposed', 'approved_operational', 'unresolved'].map((evidence, i) => row('test-draft-evidence-' + i, 'connection', { from_id: 'test-a', to_id: 'test-b', relationship_type_id: 'test-link-type', direction: 'from_to', evidence, review_status: 'draft', status: 'draft', statement_id: evidence === 'documentary' ? 'test-statement' : null, statement_revision: evidence === 'documentary' ? 1 : null, is_fixture: true })),
    ];
    const result = await request('POST', '/nervous-breakdown/import', { format: 'timsys.nervous-breakdown.v1', records, reason: 'Synthetic draft analysis' });
    expect(result.status).toBe(200);
    expect(result.data.report.warnings.filter(w => ['test-general-a', 'test-general-b'].includes(w.record_id) && w.code === 'POSSIBLE_DUPLICATE')).toEqual([]);
    expect(result.data.report.warnings.some(w => w.record_id === 'test-draft-responsibility' && w.code === 'UNRESOLVED_LEVEL')).toBe(false);
    const selected = (await request('GET', '/nervous-breakdown/graph?fixtures=true&status=all&term_id=test-level')).data;
    expect(selected.nodes.map(r => r.id)).toEqual(['test-draft-responsibility']);
    const exported = (await request('GET', '/nervous-breakdown/export')).data;
    for (const r of records.filter(r => r.kind === 'connection' || r.kind === 'responsibility')) {
      const saved = exported.records.find(x => x.id === r.id);
      expect(saved.data.evidence).toBe(r.data.evidence); expect(saved.data.review_status).toBe('draft');
    }
    expect((await request('POST', '/nervous-breakdown/import', { ...exported, reason: 'Synthetic replay', confirm_review: true })).data.report.counts.changes).toBe(0);
    expect((await request('GET', '/nervous-breakdown/export')).data.records).toEqual(exported.records);
  });
  test('levels remain optional, wrong references reject, and drafts cannot activate or use role endpoints', async () => {
    const records = (await request('GET', '/nervous-breakdown/workspace')).data.records;
    const draft = records.find(r => r.id === 'test-draft-responsibility');
    for (const level_id of [null, undefined]) {
      const result = await request('POST', '/nervous-breakdown/import', { format: 'timsys.nervous-breakdown.v1', reason: 'Optional level preflight', dry_run: true, records: [{ ...draft, expected_revision: draft.revision, data: { ...draft.data, level_id } }] });
      expect(result.status).toBe(200);
    }
    for (const data of [{ ...draft.data, level_id: 'unknown-level' }, { ...draft.data, level_id: 'test-domain' }, { ...draft.data, status: 'active' }]) {
      expect((await batch([{ ...draft, expected_revision: draft.revision, data }])).status).toBe(400);
    }
    const edge = records.find(r => r.id === 'test-draft-evidence-0');
    expect((await batch([{ ...edge, expected_revision: edge.revision, data: { ...edge.data, to_id: 'test-role' } }])).status).toBe(400);
    expect((await batch([{ ...edge, expected_revision: edge.revision, data: { ...edge.data, to_id: null } }])).status).toBe(400);
  });
  test('symmetric draft term and companion chain survive service import/export without activation', async () => {
    const term=row('test-companion-type','term',{name:'Synthetic companions',category:'relationship_type',directionality:'symmetric',grouping:'source_statement',review_status:'draft',status:'draft',is_fixture:true});
    const nodes=['A','B','C','D','E'].map(id=>row('chain-'+id,'responsibility',{name:'Synthetic chain '+id,normalized_statement:'Synthetic chain '+id,role_id:'test-role',statement_id:'test-statement',statement_revision:1,evidence:'documentary',review_status:'draft',status:'draft',is_fixture:true}));
    const edges=['A','B','C','D'].map((id,i)=>row('chain-edge-'+id,'connection',{from_id:'chain-'+id,to_id:'chain-'+['B','C','D','E'][i],relationship_type_id:'test-companion-type',statement_id:'test-statement',statement_revision:1,direction:'from_to',evidence:'documentary',review_status:'draft',status:'draft',is_fixture:true}));
    expect((await batch([term,...nodes,...edges])).status).toBe(200);
    const before=(await request('GET','/nervous-breakdown/export')).data;
    const graph=(await request('GET','/nervous-breakdown/graph?mode=draft_review&fixtures=true&relationship_type_id=test-companion-type&selected=chain-E&direction=downstream&depth=4')).data;
    expect(graph.edges).toHaveLength(4);expect(graph.trail.nodes).toHaveLength(5);
    expect(graph.edges.every(e=>e.semantics.directionality==='symmetric'&&e.semantics.process_order_inference==='excluded'&&e.data.review_status==='draft'&&e.data.evidence==='documentary')).toBe(true);
    const after=(await request('GET','/nervous-breakdown/export')).data;expect(after.records).toEqual(before.records);expect(after.history).toEqual(before.history);
    expect(after.records.find(r=>r.id==='test-companion-type').data).toMatchObject({directionality:'symmetric',review_status:'draft',status:'draft'});
  });

});
