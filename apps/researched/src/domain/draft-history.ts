// Store changed fields rather than copying an entire large corpus draft per keystroke.
export type Edit={path:string[];exists:boolean;value?:unknown};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function draftChanges(before:Record<string,unknown>,after:Record<string,unknown>){
 const redo:Edit[]=[],undo:Edit[]=[];
 function visit(a:Record<string,unknown>,b:Record<string,unknown>,prefix:string[]){for(const key of new Set([...Object.keys(a),...Object.keys(b)])){
  const av=a[key],bv=b[key],path=[...prefix,key];if(object(av)&&object(bv)){visit(av,bv,path);continue;}if(Object.hasOwn(a,key)===Object.hasOwn(b,key)&&JSON.stringify(av)===JSON.stringify(bv))continue;
  redo.push({path,exists:Object.hasOwn(b,key),...(Object.hasOwn(b,key)?{value:bv}:{})});undo.push({path,exists:Object.hasOwn(a,key),...(Object.hasOwn(a,key)?{value:av}:{})});
 }}visit(before,after,[]);return{redo,undo};
}
export function applyDraftChanges(state:Record<string,unknown>,edits:Edit[]){const result=structuredClone(state);for(const edit of edits){let parent=result;for(const key of edit.path.slice(0,-1)){if(!Object.hasOwn(parent,key)||!object(parent[key]))Object.defineProperty(parent,key,{value:{},writable:true,enumerable:true,configurable:true});parent=parent[key] as Record<string,unknown>;}const key=edit.path.at(-1)!;if(edit.exists)Object.defineProperty(parent,key,{value:structuredClone(edit.value),writable:true,enumerable:true,configurable:true});else delete parent[key];}return result;}
