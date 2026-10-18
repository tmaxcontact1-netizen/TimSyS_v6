// Conservative compilation screening, not a source of review boundaries.
export function suspectedCompilation(text:string){
 const lines=text.split(/\r?\n/).map(x=>x.trim().replace(/\s+/g,' '));
 return ['Characteristics:','Experience with this Director','Comments:'].some(label=>lines.filter(x=>x.toLowerCase()===label.toLowerCase()).length>1)||lines.filter(x=>/^(?:.*?\s*-\s*)?Review\s+\d+\)/i.test(x)).length>1;
}
