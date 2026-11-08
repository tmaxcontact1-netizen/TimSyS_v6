// Date controls use the school's timezone, independently of the browser timezone.
export function localTime(iso,timezone){
 if(!iso)return '';
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso)).map(p=>[p.type,p.value]));
 return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
export function schoolTime(value,timezone){
 if(!value)return '';
 const wall=Date.parse(value+'Z');if(!Number.isFinite(wall))throw Error('Choose a valid date and time.');
 const offsets=[...new Set([-86400000,0,86400000].map(delta=>{const t=wall+delta;return Date.parse(localTime(new Date(t).toISOString(),timezone)+'Z')-t;}))];
 const matches=offsets.map(offset=>new Date(wall-offset).toISOString()).filter(iso=>localTime(iso,timezone)===value);
 if(matches.length!==1)throw Error('This time is skipped or repeated by a daylight-saving change. Choose an unambiguous appointment time.');
 return matches[0];
}
