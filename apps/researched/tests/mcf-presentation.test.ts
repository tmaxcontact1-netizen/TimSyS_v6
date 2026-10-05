import {describe,it,expect} from 'vitest';
// @ts-expect-error Frontend module is tested as shipped JavaScript.
import {progress,competencyResults,sourceName,errorMessage,count} from '../frontend/src/mcf/presentation.js';
describe('human MCF presentation',()=>{
 it('does not treat empty or incomplete coding as completed research',()=>{expect(progress({units:[]})).toEqual({total:0,coded:0,remaining:0,complete:false});expect(progress({units:[{decision:{reviewed_no_code:true}},{decision:null}]})).toEqual({total:2,coded:1,remaining:1,complete:false});});
 it('counts current multi-code evidence independently without rollups',()=>{const units=[{id:'a',decision:{codes:[{competencyId:'A1'},{competencyId:'B1'}]}},{id:'b',decision:{codes:[],reviewed_no_code:true}},{id:'c',decision:null}];const rows=competencyResults({units},{competencies:[{id:'A1'},{id:'B1'},{id:'C1'}]});expect(rows.map((r:{units:{id:string}[]})=>r.units.map(u=>u.id))).toEqual([['a'],['a'],[]]);});
 it('uses source names, optional institutions and human errors',()=>{expect(sourceName({filename:'pilot.txt',review_identifier:'document'})).toBe('pilot.txt');expect(sourceName({filename:'pilot.txt'})).toBe('pilot.txt');expect(errorMessage('stale_decision')).toContain('Reopen');expect(errorMessage('unknown')).not.toContain('unknown');expect(count(1,'section')).toBe('1 section');});
});
