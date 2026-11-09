import type {CapturedPage} from '../domain/content-analysis.js';
export type CourseUnit = {id:string; code:string|null; title:string; overview:string[]; sourceUrl:string; programmeSection:string; locator:string; evidenceIds:string[]};
const code=/\b([A-Z]{2,8}\s?-?\d{3,5}[A-Z]?)\s*(?:[—–:-]\s*)?(.+)/;
const curriculum=/curricul|modules?|course(?:s|work| list| descriptions?| requirements?)|program(?:me)? (?:structure|schedule)|units of study/i;
const generic=/^(?:(?:required|core|elective|optional)\s+)?(?:curriculum|courses?|modules?|electives?|course descriptions?|program requirements?|sample program schedule|admissions?|apply|contact|tuition|learning outcomes?)\s*:?$/i;
/** Source-backed documentary extraction only. Missing descriptions are never generated. */
export function extractCourseUnits(pages:CapturedPage[]):CourseUnit[]{
 const result:CourseUnit[]=[];
 for(const page of pages){
  let current:CourseUnit|null=null, continueOverview=false;
  for(const b of page.blocks){
   const tag=b.locator.split(' ')[0]??'',match=code.exec(b.text),section=b.heading;
   const inCurriculum=curriculum.test(section);
   const heading=/^h[2-6]$/.test(tag)||tag==='dt';
   const coded=match&&match.index<45&&(inCurriculum||heading||tag==='tr'||tag==='dt')&&!/admission|contact|privacy|tuition|fee/i.test(section);
   const titleOnly=!coded&&inCurriculum&&(heading||tag==='li')&&b.text.length<160&&!/[.!?]$/.test(b.text)&&!generic.test(b.text)&&!/(?:courses?\s*\(\d+ units?\)|specialization)\s*:\s*$/i.test(b.text)&&!/^(?:(?:explore|view|see|browse|download)\b|\d+\s*(?:credits?|hours?))/i.test(b.text);
   if(coded||titleOnly){
    const raw=coded?match![2]!:b.text;
    const split=[raw]; // Colons and dashes may be part of the published unit title.
    const title=split[0]!.replace(/\s*\(?\d+(?:\.\d+)?\s*(?:cr\.?|credits?|credit hours?)\)?\.?\s*$/i,'').trim();
    if(!title||title.length>190){current=null;continue;}
    current={id:b.id,code:coded?match![1]!:null,title,overview:split.length>1?[split.slice(1).join(': ')]:[],sourceUrl:page.url,programmeSection:section,locator:b.locator,evidenceIds:[b.id]};continueOverview=heading||['p','dt','page','paragraph'].includes(tag);result.push(current);continue;
   }
   if(heading){current=null;continue;}
   if(current && continueOverview && (['p','dd','page','paragraph'].includes(tag)) && b.heading===current.programmeSection && !/^(?:prerequisite|credits?|course code|apply|contact|tuition|for (?:more|additional) information)/i.test(b.text)){
    current.overview.push(b.text);current.evidenceIds.push(b.id);
   }
  }
 }
 // Keep page/section associations, including repeated codes across programmes.
 return result.filter((r,i)=>result.findIndex(x=>x.sourceUrl===r.sourceUrl&&x.programmeSection===r.programmeSection&&x.code===r.code&&x.title===r.title)===i);
}
