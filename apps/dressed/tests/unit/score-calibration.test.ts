import {expect,test} from 'vitest';
import {calibratedScore,calibratedGrade} from '../../src/domain/outfit/score-calibration.js';
import type {RuleOutcome} from '../../src/domain/outfit/styling-engine.js';
const rule=(domain:string,scoreDelta:number,provisional=false):RuleOutcome=>({ruleId:domain,domain,scoreDelta,passed:scoreDelta>0,hardFailure:false,explanationCode:'test',explanation:'test',affectedGarmentIds:[],measurements:{provisional}});
const thresholds={a:85,b:72,c:60};
test('overlapping colour bonuses cannot inflate a basic outfit to A',()=>{
 const rules=[rule('colour',4),rule('colour',5),rule('colour',3),rule('pattern',3),rule('formality',4)];
 expect(calibratedScore(rules,true)).toBe(75);
 expect(calibratedScore([...rules,rule('colour',5)],true)).toBe(75);
 expect(calibratedGrade(75,true,rules,thresholds)).toBe('B');
});
test('negative findings retain full weight and can move an outfit to C',()=>{
 const rules=[rule('colour',12),rule('pattern',3),rule('formality',4),rule('ensemble',-6)];
 expect(calibratedScore(rules,true)).toBe(69);
 expect(calibratedGrade(69,true,rules,thresholds)).toBe('C');
});
test('legacy letter bands follow the numerical score; confidence is now reported separately',()=>{
 const known=[rule('colour',8),rule('pattern',6),rule('formality',6),rule('ensemble',6)];
 const score=calibratedScore(known,true);expect(score).toBe(86);
 expect(calibratedGrade(score,true,known,thresholds)).toBe('A');
 expect(calibratedGrade(99,true,[...known,rule('pattern',0,true)],thresholds)).toBe('A');
 expect(calibratedGrade(99,false,known,thresholds)).toBeNull();
});
