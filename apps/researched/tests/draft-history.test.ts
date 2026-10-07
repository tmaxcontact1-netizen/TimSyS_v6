import {describe,it,expect} from 'vitest';
import {draftChanges,applyDraftChanges} from '../src/domain/draft-history.js';
describe('reversible draft history',()=>{
 it('round-trips nested decisions, source removal and explicit nulls',()=>{const a={step:3,sources:['one','two'],decisions:{one:{codes:['A1'],notes:'before'}},final:null},b={step:4,sources:['one'],decisions:{one:{codes:[],notes:'changed'},two:{codes:['B1']}},final:'report'};const d=draftChanges(a,b);expect(applyDraftChanges(a,d.redo)).toEqual(b);expect(applyDraftChanges(b,d.undo)).toEqual(a);expect(a.decisions.one.notes).toBe('before');});
 it('does not duplicate unchanged corpus selections in each coding revision',()=>{const a={unitIds:Array.from({length:10000},(_,i)=>String(i)),decisions:{a:{notes:'old'}}},b={...a,decisions:{a:{notes:'new'}}};const d=draftChanges(a,b);expect(d.redo).toHaveLength(1);expect(JSON.stringify(d).length).toBeLessThan(250);});
 it('preserves missing versus null and whole-container replacement',()=>{const a={a:{x:null},b:[]},b={a:null,c:{value:1}};const d=draftChanges(a,b);expect(applyDraftChanges(a,d.redo)).toEqual(b);expect(applyDraftChanges(b,d.undo)).toEqual(a);});
 it('handles untrusted property names without changing prototypes',()=>{const a={},b=JSON.parse('{"__proto__":{"polluted":true}}');const result=applyDraftChanges(a,draftChanges(a,b).redo);expect(Object.hasOwn(result,'__proto__')).toBe(true);expect(({} as any).polluted).toBeUndefined();});
});
