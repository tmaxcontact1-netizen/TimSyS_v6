// Preserve researcher choices, splitting only at newly recognised questionnaire boundaries.
export function reconcileReviewBreaks(value,preview){
 if(!value)return preview.candidates.map(c=>({start:c.start,end:c.end,confirmed:false,institution:{state:'unassigned',name:'',note:''},include:['narrative'],notes:''}));
 return value.flatMap(r=>{
  const starts=preview.blocks.filter(b=>b.component==='questionnaire'&&b.index>r.start&&b.index<r.end).map(b=>preview.candidates.find(c=>c.start<=b.index&&c.end>b.index)?.start??b.index).filter(n=>n>r.start&&n<r.end);
  if(!starts.length)return [r];
  const boundaries=[r.start,...new Set(starts),r.end].sort((a,b)=>a-b);
  return boundaries.slice(0,-1).map((start,i)=>({...r,start,end:boundaries[i+1],confirmed:false}));
 });
}
export function nextUnchecked(records,after=-1){
 for(let step=1;step<=records.length;step++){const i=(after+step)%records.length;if(!records[i].confirmed)return i;}
 return 0;
}
