import {jdFixture} from './landscape-fixtures.mjs';
import {fromJd} from '../apps/principaled/src/documentary-landscape/model.ts';
export function connectionFixture(count=5,large=false){
  const model=fromJd(jdFixture(large?200:2,large?25000:4));
  const s=[...model.statements.values()][0],c=model.containers.find(c=>c.id===s.containerId),target=model.containers[1];
  s.text='Relationship fixture origin. '+Array.from({length:count},()=>`works with ${target.title}.`).join(' ');
  const records=[];let offset=0;
  for(let i=0;i<count;i++){
    const phrase='works with',at=s.text.indexOf(phrase,offset),counterpart=target.title,start=at+phrase.length+1;offset=start+counterpart.length;
    records.push({id:`synthetic-connection-${i}`,status:'documented_relationship',documentId:c.source.documentId,passageId:s.passageId,
      phrase,counterpart,counterpartWording:counterpart,actor:c.title,sourceRole:c.title,sourceDocument:c.source.filename,sourceLocation:s.location,
      fullSourceSentence:s.text,fullSourcePassage:s.text,passageStart:0,passageEnd:s.text.length,phraseSpan:{start:at,end:at+phrase.length},
      counterpartSpan:{start,end:start+counterpart.length},sentenceSpan:{start:0,end:s.text.length},statedObject:'',purposeOrCondition:'',statedCondition:'',
      resolvedDocumentId:target.source.documentId,resolution:'exact_documentary_title'});
  }
  return {model,statement:s,records};
}
