// Synthetic, in-memory documentary fixtures. Never registered or imported into a live store.
export function jdFixture(roles=10,total=300) {
  const id='00000000-0000-4000-8000-000000000001';
  let ordinal=0;
  return {id,title:'SYNTHETIC navigation fixture — not organisational evidence',revision:'synthetic',
    review:{roles:{},excluded:[]},documents:Array.from({length:roles},(_,r)=>{
      const documentId=`00000000-0000-4000-8000-${String(r+2).padStart(12,'0')}`;
      const count=Math.floor(total/roles)+(r<total%roles?1:0), passages=[];let extracted='';
      for(let i=0;i<count;i++){
        const text=`Synthetic documentary statement ${++ordinal}: retain this wording for navigation testing only. ${ordinal===total?'Scale search destination.':''}`;
        passages.push({id:`synthetic-${r}-${i}`,text,dimension:`Original section ${Math.floor(i/25)+1}`,kind:'statement',location:`Synthetic paragraph ${i+1}`,start:extracted.length,end:extracted.length+text.length});
        extracted+=text+'\n\n';
      }
      return {id:documentId,role:`Synthetic role ${String(r+1).padStart(3,'0')}`,filename:`Synthetic role ${r+1}.txt`,sha256:'synthetic',passages,extracted};
    })};
}
export function policyFixture() {
  const container={id:'synthetic-policy',title:'Synthetic Behaviour Policy',
    labels:{container:'Policy',section:'Section',statement:'Statement'},
    source:{documentId:'policy-source',filename:'Synthetic Behaviour Policy.txt',documentType:'Policy',revision:'synthetic',sha256:'synthetic'},sectionIds:[]};
  const model={id:'policy',title:'SYNTHETIC policy fixture',revision:'synthetic',containers:[container],sections:new Map(),statements:new Map()};
  for(let i=0;i<3;i++) {
    const section={id:`policy-section-${i}`,containerId:container.id,title:`Policy section ${i+1}`,statementIds:[]};
    model.sections.set(section.id,section);container.sectionIds.push(section.id);
    for(let j=0;j<(i===2?6:7);j++){
      const statement={id:`policy-${i}-${j}`,sectionId:section.id,containerId:container.id,text:`Synthetic policy statement ${i+1}.${j+1}. For interface testing only.`,
        location:`Policy paragraph ${i+1}.${j+1}`,passageId:`policy-${i}-${j}`,originalSection:section.title,kind:'statement'};
      model.statements.set(statement.id,statement);section.statementIds.push(statement.id);
    }
  }
  return model;
}
