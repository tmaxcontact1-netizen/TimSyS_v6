'use strict';
const { graph, trail, validateNetwork, clean } = require('../../modules/nervous_breakdown/model');
test('dense deterministic traversal remains bounded and preserves every graph node', () => {
  const records = Array.from({ length: 1200 }, (_, i) => ({ id: 'r' + i, kind: 'responsibility', data: { name: 'Node ' + i, role_id: 'role', status: 'active', is_fixture: false, domain_ids: [], responsibility_type_ids: [], authority_type_ids: [] } }));
  for (let i = 0; i < 1199; i++) for (const offset of [1, 3, 7]) if (i + offset < 1200) records.push({ id: `e${i}-${offset}`, kind: 'connection', data: { from_id: 'r' + i, to_id: 'r' + (i + offset), status: 'active', review_status: 'reviewed', is_fixture: false } });
  const network = graph(records); expect(network.nodes).toHaveLength(1200);
  const selected = trail(network, 'r0', 'downstream', 2);
  expect(selected.nodes.length).toBeLessThan(15); expect(selected.nodes).not.toContain('r1199');
  expect(trail(network, 'r0', 'upstream', 2).nodes).toEqual(['r0']);
  expect(trail(network, 'r0', 'downstream', 2)).toEqual(selected);
});
test('ontology changes reject cycles rather than silently repairing the taxonomy', () => {
  const records = ['a', 'b'].map((id, i) => ({ id, kind: 'term', revision: 1, data: clean('term', { name: id, category: 'domain', definition: 'Fixture', parent_id: i ? 'a' : 'b' }) }));
  expect(() => validateNetwork(records)).toThrow('hierarchy loop');
});
test('draft review is a renderer-neutral read projection and does not weaken normal edge visibility', () => {
  const nodes = ['a', 'b'].map(id => ({ id, kind: 'responsibility', data: { name: id, status: 'draft', review_status: 'draft', is_fixture: true } }));
  const records = [...nodes, ...['inferred', 'proposed'].map(evidence => ({ id: evidence, kind: 'connection', data: { from_id: 'a', to_id: 'b', evidence, status: 'draft', review_status: 'draft', is_fixture: true } }))];
  const before = JSON.stringify(records);
  expect(graph(records, { fixtures: 'true' }).nodes).toEqual([]);
  expect(graph(records, { fixtures: 'true', status: 'all' }).edges).toEqual([]);
  const review = graph(records, { fixtures: 'true', mode: 'draft_review' });
  expect(review.nodes).toHaveLength(2); expect(review.edges).toHaveLength(2);
  expect(trail(review, 'a', 'downstream', 1).nodes).toEqual(['a', 'b']);
  expect(graph(records, { fixtures: 'true', mode: 'draft_review', evidence: 'inferred' }).edges.map(e => e.id)).toEqual(['inferred']);
  expect(graph(records, { mode: 'draft_review' }).nodes).toEqual([]);
  expect(JSON.stringify(records)).toBe(before);
  expect(() => graph(records, { mode: 'approve' })).toThrow('Unknown graph mode');
});
