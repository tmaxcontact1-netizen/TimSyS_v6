// Browser view omits duplicate raw output envelopes and per-unit copies of review metadata.
// Evidence, decisions, context, review-level provenance and full export routes are unchanged.
export function mcfReportView(session:any,machine:any){
 const {outputs,aiAmbiguity,...view}=machine??{};
 return {session:{...session,units:session.units.map(({locator,...unit}:any)=>unit)},machineOutputs:machine?view:null};
}
