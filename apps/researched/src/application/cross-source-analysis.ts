import type {AnalysisEvidence} from "./ai-analysis.js";

export const CROSS_SOURCE_ANALYSIS_TYPES=new Set(["themes","comparison","contradictions"]);
export interface CorpusSource{source_id:string;label:string;entity_id?:string|null;entity_path?:string[];evidence_segments:{segmentId:string;sourceId:string;content:string}[]}

export function balancedCorpusEvidence(sources:readonly CorpusSource[],maximumCharacters=100_000):AnalysisEvidence[]{
  if(!sources.length)return[];
  const perSource=Math.max(1,Math.floor(maximumCharacters/sources.length)),result:AnalysisEvidence[]=[];
  for(const source of sources){let remaining=perSource;for(const segment of source.evidence_segments){if(remaining<=0)break;const heading=`Source: ${source.label}${source.entity_path?.length?` | Hierarchy: ${source.entity_path.join(" > ")}`:""}\n`;const content=heading+segment.content.slice(0,Math.max(0,remaining-heading.length));remaining-=content.length;if(content.length>heading.length)result.push({...segment,content});}}
  return result;
}

export function corpusInstructions(type:string,sources:readonly CorpusSource[]){
  const catalogue=sources.map(source=>`${source.source_id}: ${source.label}${source.entity_path?.length?` (${source.entity_path.join(" > ")})`:""}`).join("\n");
  return `This is a cross-source ${type} analysis. Compare the sources as a corpus; do not analyse them as though they were one document. Source catalogue:\n${catalogue}\nEvery source relationship in the result must use one of these source IDs.`;
}
