'use strict';
var trends=require('../../shared/services/intelligence/trendAnalysis');
describe('historical trend analysis',function(){
 test('distinguishes material improvement and reports small-sample uncertainty',function(){var result=trends.evaluate(2,6,{minimumAbsoluteChange:2,minimumRelativeChange:.3,smallSampleBelow:10,fullConfidenceAt:10});expect(result.direction).toBe('decreased');expect(result.material).toBe(true);expect(result.percentChange).toBeCloseTo(-66.67,1);expect(result.uncertainty).toMatch(/small/);});
 test('does not invent a percentage when the baseline is zero',function(){var result=trends.evaluate(3,0,{});expect(result.ratio).toBeNull();expect(result.percentChange).toBeNull();expect(result.uncertainty).toMatch(/percentage/);});
 test('rejects unequal comparison periods',function(){expect(function(){trends.comparable({start:0,end:10},{start:0,end:20});}).toThrow(/equal length/);});
});
