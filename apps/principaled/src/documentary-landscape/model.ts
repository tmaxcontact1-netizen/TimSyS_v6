/** Renderer contract: documentary containment only. It has no relationship or workflow fields. */
export type Source = {documentId:string; filename:string; documentType:string; revision:string; sha256:string};
export type Statement = {id:string; sectionId:string; containerId:string; text:string; location:string; passageId:string; originalSection:string; kind:string};
export type Section = {id:string; containerId:string; title:string; statementIds:string[]};
export type Container = {id:string; title:string; source:Source; sectionIds:string[]; labels:{container:string;section:string;statement:string}};
export type Landscape = {id:string; title:string; revision:string; containers:Container[]; sections:Map<string,Section>; statements:Map<string,Statement>};
export type Passage = {id:string;text:string;dimension:string;kind:string;location:string};
export type Snapshot = {id:string;title:string;revision:string;review:{roles:Record<string,string>;excluded:string[];structure?:Record<string,{kind:string;dimension:string}>};documents:{id:string;filename:string;role:string;sha256:string;passages:Passage[]}[]};

/** Mirrors only the frozen reviewedPassages projection; never calls extraction/analysis. */
export function fromJd(snapshot:Snapshot):Landscape {
  const result:Landscape={id:snapshot.id,title:snapshot.title,revision:snapshot.revision,containers:[],sections:new Map(),statements:new Map()};
  const excluded=new Set(snapshot.review.excluded);
  for(const d of snapshot.documents) {
    const id=`${snapshot.id}/${d.id}`;
    const container:Container={id,title:snapshot.review.roles[d.id]||d.role||'Role not established',
      source:{documentId:d.id,filename:d.filename,documentType:'Job description',revision:snapshot.revision,sha256:d.sha256},
      sectionIds:[],labels:{container:'Role',section:'Original dimension',statement:'Responsibility'}};
    result.containers.push(container);
    let headingOverride:string|null=null, section:Section|undefined, lastDimension:string|undefined;
    for(const p of d.passages) {
      if(p.kind==='heading') headingOverride=null;
      const correction=snapshot.review.structure?.[p.id];
      if(correction?.kind==='heading') headingOverride=p.text.trim();
      const dimension=correction?.dimension??headingOverride??p.dimension;
      const kind=correction?.kind??p.kind;
      // A new occurrence of a heading remains separate, even when its wording repeats.
      if(kind==='heading'||dimension!==lastDimension) {section=undefined;lastDimension=dimension;}
      if(!['statement','descriptor'].includes(kind)||excluded.has(p.id)) continue;
      if(!section) {
        section={id:`${id}/section/${p.id}`,containerId:id,title:dimension,statementIds:[]};
        result.sections.set(section.id,section);container.sectionIds.push(section.id);
      }
      const statement:Statement={id:`${id}/statement/${p.id}`,sectionId:section.id,containerId:id,text:p.text,location:p.location,passageId:p.id,originalSection:p.dimension,kind};
      if(result.statements.has(statement.id)) throw Error('Duplicate documentary identity');
      result.statements.set(statement.id,statement);section.statementIds.push(statement.id);
    }
  }
  result.containers.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  return result;
}

/** Trigram index supports literal, case-insensitive phrase retrieval (including partial words). */
export class SearchIndex {
  private postings=new Map<string,Set<string>>();
  private text=new Map<string,string>();
  model:Landscape;
  constructor(model:Landscape) {
    this.model=model;
    const containers=new Map(model.containers.map(c=>[c.id,c]));
    for(const s of model.statements.values()) {
      const c=containers.get(s.containerId)!;
      const text=[s.text,model.sections.get(s.sectionId)!.title,c.title,c.source.filename,c.source.documentType].join('\n').toLocaleLowerCase();
      this.text.set(s.id,text);
      for(const gram of grams(text)) {
        let ids=this.postings.get(gram);if(!ids){ids=new Set();this.postings.set(gram,ids);}ids.add(s.id);
      }
    }
  }
  find(query:string):Statement[] {
    const q=query.trim().toLocaleLowerCase();if(!q)return [];
    const sets=[...grams(q)].map(g=>this.postings.get(g)||new Set<string>()).sort((a,b)=>a.size-b.size);
    const ids=sets.length?sets[0]:this.text.keys();
    return [...ids].filter(id=>sets.every(s=>s.has(id))&&this.text.get(id)!.includes(q)).map(id=>this.model.statements.get(id)!);
  }
}
function grams(text:string):Set<string> {const result=new Set<string>();for(let i=0;i<text.length-2;i++)result.add(text.slice(i,i+3));return result;}

export type Context={containerId?:string;sectionId?:string;statementId?:string;source?:boolean};
export type Camera={x:number;y:number;zoom:number};
export type Frame={context:Context;camera:Camera};
export const home=():Frame=>({context:{},camera:{x:32,y:32,zoom:1}});
export function ancestors(context:Context):Context[] {
  return [{},...(context.containerId?[{containerId:context.containerId}]:[]),
    ...(context.sectionId?[{containerId:context.containerId,sectionId:context.sectionId}]:[]),
    ...(context.statementId?[{containerId:context.containerId,sectionId:context.sectionId,statementId:context.statementId}]:[])];
}
export function contextItems(model:Landscape,context:Context):string[] {
  if(context.sectionId)return model.sections.get(context.sectionId)?.statementIds||[];
  if(context.containerId)return model.containers.find(c=>c.id===context.containerId)?.sectionIds||[];
  return model.containers.map(c=>c.id);
}
export type Tile={id:string;x:number;y:number;width:number;height:number};
const layouts=new WeakMap<Landscape,Map<string,Tile[]>>();
/** Fixed four-column documentary shelves: screen size never reshuffles geography. */
export function layout(model:Landscape,context:Context):Tile[] {
  let cache=layouts.get(model);if(!cache){cache=new Map();layouts.set(model,cache);}
  const key=context.sectionId||context.containerId||'home';
  let tiles=cache.get(key);
  if(!tiles){tiles=contextItems(model,context).map((id,i)=>({id,x:(i%4)*330,y:Math.floor(i/4)*210,width:290,height:166}));cache.set(key,tiles);}
  return tiles;
}
export function visible(tiles:Tile[],camera:Camera,width:number,height:number):Tile[] {
  const margin=60;
  return tiles.filter(t=>(t.x+t.width)*camera.zoom+camera.x>=-margin&&t.x*camera.zoom+camera.x<=width+margin&&
    (t.y+t.height)*camera.zoom+camera.y>=-margin&&t.y*camera.zoom+camera.y<=height+margin);
}
export function detailLevel(zoom:number):'overview'|'preview' {return zoom>=1.25?'preview':'overview';}
