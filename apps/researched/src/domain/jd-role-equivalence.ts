/** Researcher declarations are retained for audit only. They never rewrite source titles or create edges. */
export type RoleEquivalence={id:string;left:string;right:string;reason:string;recordedAt:string;origin:'researcher'};
export function recordRoleEquivalences(requested:RoleEquivalence[],prior:RoleEquivalence[],available:string[],now:string):RoleEquivalence[]{
 const ids=new Set<string>();
 return requested.map(value=>{
  if(ids.has(value.id))throw Error('Duplicate role-equivalence decision ID');ids.add(value.id);
  const old=prior.find(x=>x.id===value.id);
  if(old){if(JSON.stringify(old)!==JSON.stringify(value))throw Error('Existing equivalence decisions are immutable; use a new decision ID');return old;}
  if(value.left===value.right||![value.left,value.right].every(x=>available.includes(x)))throw Error('Choose two distinct role titles present in the source or checked role fields');
  if(!value.reason.trim())throw Error('Record a reason for the researcher equivalence decision');
  return{...value,recordedAt:now,origin:'researcher'};
 });
}
