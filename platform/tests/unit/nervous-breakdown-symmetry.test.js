'use strict';
const m = require('../../modules/nervous_breakdown/model');
const fixture = () => {
  const row = (id, kind, data) => ({ id, kind, revision: 1, data: { status: 'draft', review_status: 'draft', is_fixture: true, ...data } });
  return [row('role', 'role', {}), row('source', 'source', { role_id: 'role' }), row('s', 'statement', { source_id: 'source' }),
    row('companion', 'term', { category: 'relationship_type', directionality: 'symmetric', grouping: 'source_statement' }),
    row('directed', 'term', { category: 'relationship_type' }),
    ...['A','B','C','D','E'].map(id => row(id, 'responsibility', { name: id, role_id: 'role', statement_id: 's', statement_revision: 1, evidence: 'documentary' })),
    ...['A','B','C','D'].map((id, i) => row('e'+i, 'connection', { from_id: id, to_id: ['B','C','D','E'][i], relationship_type_id: 'companion', statement_id: 's', statement_revision: 1, evidence: 'documentary' }))];
};
test('one symmetric chain traverses in either direction and exposes documentary grouping without process order', () => {
  const records = fixture(), before = JSON.stringify(records); m.validateNetwork(records);
  const g = m.graph(records, { mode: 'draft_review', fixtures: 'true' });
  expect(g.edges).toHaveLength(4);
  for (const direction of ['upstream','downstream','both']) {
    expect(m.trail(g, 'A', direction, 4).nodes).toHaveLength(5);
    expect(m.trail(g, 'E', direction, 4).nodes).toHaveLength(5);
  }
  expect(g.statement_groups[0].nodes).toEqual(['A','B','C','D','E']);
  expect(g.edges.every(e => e.semantics.directionality === 'symmetric' && e.semantics.process_order_inference === 'excluded')).toBe(true);
  expect(m.graph(records, { mode: 'draft_review', fixtures: 'true', evidence: 'inferred' }).edges).toEqual([]);
  expect(m.graph(records, { mode: 'draft_review', fixtures: 'true', relationship_type_id: 'directed' }).edges).toEqual([]);
  expect(m.graph(records, { fixtures: 'true' }).edges).toEqual([]);
  expect(JSON.stringify(records)).toBe(before);
});
test('legacy relationship types remain directed and reverse duplicates of symmetric edges are rejected', () => {
  const records = fixture(); records.push({ id:'d', kind:'connection', data:{ ...records.at(-1).data, from_id:'A',to_id:'E',relationship_type_id:'directed',evidence:'inferred' } });
  const g = m.graph(records, {mode:'draft_review',fixtures:'true',relationship_type_id:'directed'});
  expect(g.edges[0].semantics.directionality).toBe('directed');
  expect(m.trail(g,'E','downstream',1).nodes).toEqual(['E']);
  expect(m.trail(g,'E','upstream',1).nodes).toEqual(['E','A']);
  const reverse = {...records.find(r=>r.id==='e0'), id:'reverse'}; reverse.data={...reverse.data,from_id:'B',to_id:'A'};
  expect(()=>m.validateNetwork([...records,reverse])).toThrow('Duplicate symmetric');
});
test('grouping rejects false documentary co-membership and optional semantics do not rewrite legacy terms', () => {
  const records=fixture();records.find(r=>r.id==='A').data.statement_revision=2;
  expect(()=>m.validateNetwork(records)).toThrow();
  const old=m.clean('term',{name:'Old',category:'relationship_type'});expect(old).not.toHaveProperty('directionality');
  expect(()=>m.clean('term',{name:'Invalid',category:'domain',directionality:'symmetric'})).toThrow();
  expect(()=>m.clean('term',{name:'Invalid',category:'relationship_type',directionality:'directed',grouping:'source_statement'})).toThrow();
});
