import {z} from 'zod';
export const weeklyPlanSchema=z.object({
 name:z.string().trim().min(1).max(120),
 visibleWeeks:z.number().int().min(1).max(10),
 weeks:z.array(z.array(z.string().uuid().nullable()).length(7)).length(10),
}).strict();
export const emptyWeeklyPlan={name:'My weekly rotation',visibleWeeks:4,weeks:Array.from({length:10},()=>Array(7).fill(null) as (string|null)[])};
