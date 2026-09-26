export interface ProgrammeCandidate {
  readonly institution:string;
  readonly programmeName:string;
  readonly qualificationLevel:"masters"|"doctorate"|"other";
  readonly originalUrl:string;
  readonly canonicalUrl:string;
  readonly ordinal:number;
}

const urlPattern=/https?:\/\/[^\s<>"“”]+/giu;
const levelPattern=/^\s*(master(?:'|’)?s?|doctorate|doctoral)\s+level\s*$/iu;
const ignoredHeading=/^(US University|School of Education|College of Education|Graduate School|Doctorate Level|Master(?:'|’)?s? Level)/iu;

export function canonicalProgrammeUrl(value:string){
  const cleaned=value.replace(/[),.;]+$/u,"").replace(/\\$/u,"");
  const url=new URL(cleaned);
  url.hash="";
  for(const key of [...url.searchParams.keys()]) if(/^utm_|^(?:srsltid|fbclid|gclid)$/iu.test(key)) url.searchParams.delete(key);
  return url.href;
}

function labelBeforeUrl(line:string,url:string){return line.slice(0,line.indexOf(url)).replace(/[:\s]+$/u,"").trim();}
function looksInstitution(line:string){return !line.includes("http")&&!ignoredHeading.test(line)&&line.length>=3&&line.length<=180&&!/[.:;]$/u.test(line);}

export function extractProgrammeCandidates(text:string):readonly ProgrammeCandidate[]{
  const lines=text.replace(/\r/g,"").replace(/(\S)(Master(?:'|’)?s?|Doctorate|Doctoral)\s+Level/giu,"$1\n$2 Level").split("\n").map(line=>line.replace(/\s+/g," ").trim()).filter(Boolean);
  let inProgrammeSection=false,institution="Unknown institution",level:ProgrammeCandidate["qualificationLevel"]="other",ordinal=0;
  const found=new Map<string,ProgrammeCandidate>();
  for(const line of lines){
    if(/US University.*Educational Leadership Programmes/iu.test(line)){inProgrammeSection=true;continue;}
    if(!inProgrammeSection) continue;
    if(/^Principals Training Centre$/iu.test(line)) break;
    const levelMatch=levelPattern.exec(line);
    if(levelMatch){level=/master/iu.test(levelMatch[1]!)?"masters":"doctorate";continue;}
    const urls=line.match(urlPattern)??[];
    if(!urls.length){if(looksInstitution(line)) institution=line;continue;}
    for(const rawUrl of urls){
      let canonicalUrl:string;
      try{canonicalUrl=canonicalProgrammeUrl(rawUrl);}catch{continue;}
      if(found.has(canonicalUrl)) continue;
      const programmeName=labelBeforeUrl(line,rawUrl)||institution;
      found.set(canonicalUrl,Object.freeze({institution,programmeName,qualificationLevel:level,originalUrl:rawUrl.replace(/[),.;]+$/u,""),canonicalUrl,ordinal:++ordinal}));
    }
  }
  return Object.freeze([...found.values()]);
}

const unique=(values:readonly string[])=>[...new Set(values.map(value=>value.trim()).filter(Boolean))];
const sentences=(text:string)=>text.replace(/\s+/g," ").split(/(?<=[.!?])\s+/u).map(value=>value.trim()).filter(Boolean);
const snippets=(text:string,pattern:RegExp,maximum=8)=>unique(sentences(text).filter(value=>pattern.test(value))).slice(0,maximum);

export function extractProgrammeRecord(text:string,candidate:ProgrammeCandidate){
  const credit=snippets(text,/\b(?:credit|semester|quarter)\s*(?:hours?|units?)?\b|\b\d+\s+(?:credits?|hours?|units?)\b/iu,3)[0]??null;
  const duration=snippets(text,/\b(?:\d+|one|two|three|four|five)\s*(?:years?|months?|semesters?)\b|\bfull[- ]time\b|\bpart[- ]time\b/iu,3)[0]??null;
  const delivery=unique([...( /\bonline\b/iu.test(text)?["Online"]:[]),...( /\bon[ -]?campus|in person\b/iu.test(text)?["On campus"]:[]),...( /\bhybrid\b/iu.test(text)?["Hybrid"]:[])]);
  const curriculum=snippets(text,/\b(course|curriculum|module|concentration|speciali[sz]ation|core requirement|elective|dissertation|capstone|internship|practicum)\b/iu,16);
  const admissions=snippets(text,/\b(admission|applicant|application|GPA|transcript|recommendation|GRE|statement of purpose|prerequisite)\b/iu,12);
  const outcomes=snippets(text,/\b(career|prepare|leadership role|principal|superintendent|licen[cs]ure|certification|graduate will|learning outcome)\b/iu,10);
  const concentrations=snippets(text,/\b(concentration|speciali[sz]ation|track|pathway|emphasis)\b/iu,8);
  const awardMatch=text.match(/\b(?:M\.?Ed\.?|MA|MS|Ed\.?D\.?|Ph\.?D\.?)\b/iu),award=awardMatch?.[0]?.replace(/^(m)\.?ed\.?$/iu,"M.Ed.").replace(/^ed\.?d\.?$/iu,"Ed.D.").replace(/^ph\.?d\.?$/iu,"Ph.D.")??null;
  const evidence=unique([...curriculum.slice(0,6),...admissions.slice(0,3),...outcomes.slice(0,3)]);
  const populated=[credit,duration,delivery.length,curriculum.length,admissions.length,outcomes.length].filter(Boolean).length;
  return Object.freeze({
    institution:candidate.institution,programmeName:candidate.programmeName,qualificationLevel:candidate.qualificationLevel,
    award,deliveryModes:delivery,duration,creditRequirement:credit,curriculum,concentrations,
    admissionRequirements:admissions,professionalOutcomes:outcomes,
    summary:curriculum[0]??outcomes[0]??`The captured page identifies ${candidate.programmeName} but provides limited structured programme detail.`,
    evidence,confidence:Number(Math.min(.95,.35+populated*.1).toFixed(3)),
    warnings:Object.freeze([...(text.length<1000?["The captured page contains limited text."]:[]),...(!curriculum.length?["No explicit curriculum or course structure was found."]:[])]),
    extractorVersion:"programme-structure-v1",
  });
}
