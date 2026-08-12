'use strict';
function evaluate(current,previous,options){options=options||{};var absolute=current-previous,ratio=previous===0?(current===0?1:null):current/previous,minimum=Math.max(options.minimumEvidence||1,current,previous),direction=absolute===0?'stable':absolute>0?'increased':'decreased';
 var material=Math.abs(absolute)>=(options.minimumAbsoluteChange||1)&&(ratio===null||Math.abs(ratio-1)>=(options.minimumRelativeChange||0));
 var confidence=Math.min(1,minimum/(options.fullConfidenceAt||20));var uncertainty=null;
 if(current+previous<(options.smallSampleBelow||10))uncertainty='The number of records is small, so this pattern may be unstable.';
 if(previous===0&&current>0)uncertainty='The comparison period contained no records, so a percentage change is not meaningful.';
 return {current:current,previous:previous,absoluteChange:absolute,ratio:ratio,percentChange:ratio===null?null:(ratio-1)*100,direction:direction,material:material,confidence:confidence,uncertainty:uncertainty};}
function comparable(current,previous){var a=current.end-current.start,b=previous.end-previous.start;if(a<=0||b<=0)throw new Error('Trend periods must have positive duration');var tolerance=Math.max(1,Math.min(a,b)*.001);if(Math.abs(a-b)>tolerance)throw new Error('Trend periods must be equal length');return true;}
module.exports={evaluate:evaluate,comparable:comparable};
