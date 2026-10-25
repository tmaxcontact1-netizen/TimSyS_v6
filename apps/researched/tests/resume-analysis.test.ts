import {it,expect} from 'vitest';
// @ts-ignore browser module
import {resumeAnalysis} from '../frontend/src/resume-analysis.js';
it.each(['legacy_provider_confirmation_required','legacy provider confirmation required'])('confirms legacy resume for API error %s',async message=>{const calls:any[]=[];const api=async(_p:any,v:any)=>{calls.push(JSON.parse(v.body));if(calls.length===1)throw Error(message);};expect(await resumeAnalysis(api,'path','actor',()=>true)).toBe(true);expect(calls).toEqual([{actor:'actor'},{actor:'actor',confirmLegacyProvider:true}]);});
it('declining confirmation makes no second request',async()=>{let n=0;expect(await resumeAnalysis(async()=>{n++;throw Error('legacy provider confirmation required');},'path','actor',()=>false)).toBe(false);expect(n).toBe(1);});
it('does not bypass genuine mismatches',async()=>{await expect(resumeAnalysis(async()=>{throw Error('Reconnect original provider');},'path','actor',()=>{throw Error('must not confirm');})).rejects.toThrow('Reconnect original provider');});
