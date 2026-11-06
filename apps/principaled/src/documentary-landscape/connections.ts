import type {Landscape,Statement} from './model';
export type Span={start:number;end:number};
export type FrozenConnection={
  id:string;status:string;documentId:string;passageId:string;phrase:string;counterpart:string;counterpartWording:string;
  actor:string;sourceRole:string;sourceDocument:string;sourceLocation:string;fullSourceSentence:string;fullSourcePassage:string;
  passageStart:number;passageEnd:number;phraseSpan:Span;counterpartSpan:Span;sentenceSpan:Span;
  statedObject:string;purposeOrCondition:string;statedCondition:string;resolvedDocumentId?:string|null;resolution?:string;
};
/** Generic visual contract. Navigation has an origin; that is NOT organisational direction. */
export type DocumentaryConnection={
  id:string;originId:string;phrase:string;counterpart:string;destinationId?:string;
  object:string;purpose:string;condition:string;direction:'unspecified';resolution:string;evidence:FrozenConnection;
};
export type Arrival={originId:string;originTitle:string;originText:string;phrase:string;counterpart:string;connectionId:string};
export function adaptConnections(model:Landscape,statement:Statement,records:FrozenConnection[]) {
  const connections:DocumentaryConnection[]=[],rejected:{id:string;reason:string}[]=[];
  const container=model.containers.find(c=>c.id===statement.containerId)!;
  const counts=new Map<string,number>();for(const r of records)counts.set(r.id,(counts.get(r.id)||0)+1);
  const key=(s:string)=>s.trim().replace(/\s+/g,' ').toLowerCase();
  for(const r of records){
    const spanMatches=(span:Span,text:string)=>span&&Number.isInteger(span.start)&&Number.isInteger(span.end)&&span.start>=r.passageStart&&span.end<=r.passageEnd&&span.end>span.start&&statement.text.slice(span.start-r.passageStart,span.end-r.passageStart)===text;
    if(r.status!=='documented_relationship')continue; // mentions/boundaries/unresolved never become connections
    if(!r.id||counts.get(r.id)!==1||r.documentId!==container.source.documentId||r.passageId!==statement.passageId||
      r.fullSourcePassage!==statement.text||r.passageEnd-r.passageStart!==statement.text.length||
      r.sourceDocument!==container.source.filename||r.sourceLocation!==statement.location||r.sourceRole!==container.title||!r.actor||
      !r.phrase||!r.counterpartWording||!spanMatches(r.phraseSpan,r.phrase)||!spanMatches(r.counterpartSpan,r.counterpartWording)||
      !spanMatches(r.sentenceSpan,r.fullSourceSentence)){
      rejected.push({id:r.id,reason:'Documentary evidence does not match the selected retained source. Connection not displayed.'});continue;
    }
    const destination=model.containers.find(c=>c.source.documentId===r.resolvedDocumentId);
    const exactMatches=model.containers.filter(c=>key(c.title)===key(r.counterpart));
    const resolved=destination&&r.resolution==='exact_documentary_title'&&exactMatches.length===1&&exactMatches[0].id===destination.id;
    connections.push({id:r.id,originId:statement.id,phrase:r.phrase,counterpart:r.counterpartWording,
      ...(resolved?{destinationId:destination.id}:{}),object:r.statedObject,purpose:r.purposeOrCondition,condition:r.statedCondition,
      direction:'unspecified',resolution:resolved?'Exact documentary title':r.resolution==='ambiguous_documentary_title'?'More than one source has this title; destination is unresolved':'No corresponding documentary source is currently present',
      evidence:r});
  }
  return {connections,rejected};
}
