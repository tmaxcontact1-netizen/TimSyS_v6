'use strict';
// Integrity partitioner. Only leading timestamps are interpreted; row tails are opaque bytes.
const fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function gateBytes(body,start,end){
  if(!Buffer.isBuffer(body)||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||end<=start)throw Error('Invalid byte-gate bounds');
  let i=0,previous=-1;const kept=[],spans=[];let dropped=0,total=0;
  const ws=()=>{while(i<body.length&&[9,10,13,32].includes(body[i]))i++;};
  const fail=reason=>{throw Error(`BYTE_GATE_REJECT:${reason}:offset=${i}`);};
  ws();if(body[i++]!==91)fail('outer-array-required');ws();
  if(body[i]===93){i++;ws();if(i!==body.length)fail('trailing-bytes');return {bytes:Buffer.from('[]'),spans,total:0,retained:0,dropped:0};}
  while(i<body.length){
    ws();const lo=i;if(body[i++]!==91)fail('row-array-required');ws();const tsStart=i;
    while(i<body.length&&body[i]>=48&&body[i]<=57)i++;
    if(i===tsStart)fail('leading-timestamp-required');
    const timestamp=Number(body.subarray(tsStart,i).toString('ascii'));ws();
    if(!Number.isSafeInteger(timestamp)||timestamp<0||body[i++]!==44)fail('invalid-leading-timestamp');
    if(timestamp<=previous)fail('misordered-or-duplicate-row');previous=timestamp;
    // Framing scan only: never JSON.parse or convert any tail field, including out-of-bounds tails.
    let quoted=false,escape=false,closed=false,lastToken=44;
    while(i<body.length){const b=body[i++];
      if(quoted){if(escape){escape=false;continue;}if(b===92){escape=true;continue;}if(b===34)quoted=false;else if(b<32)fail('control-byte-in-string');continue;}
      if(b===34){quoted=true;lastToken=b;continue;}
      if(b===91||b===123||b===125)fail('non-flat-row');
      if(b===93){if(lastToken===44)fail('empty-or-trailing-field');closed=true;break;}
      if(b===44&&lastToken===44)fail('empty-field');
      if(![9,10,13,32].includes(b))lastToken=b;
    }
    if(!closed||quoted||escape)fail('truncated-row');
    const hi=i;total++;
    if(timestamp>=start&&timestamp<end){kept.push(body.subarray(lo,hi));spans.push({rowIndex:total-1,open:timestamp,start:lo,end:hi,length:hi-lo});}else dropped++;
    ws();if(body[i]===93){i++;ws();if(i!==body.length)fail('trailing-bytes');break;}
    if(body[i++]!==44)fail('row-separator-required');ws();if(i>=body.length||body[i]===93)fail('truncated-or-trailing-row');
  }
  if(i!==body.length||body.at(-1)===44)fail('unclosed-outer-array');
  const parts=[Buffer.from('[')];kept.forEach((r,j)=>{if(j)parts.push(Buffer.from(','));parts.push(r);});parts.push(Buffer.from(']'));
  return {bytes:Buffer.concat(parts),spans,total,retained:kept.length,dropped};
}
function guardedRows(body,start,end){const gated=gateBytes(body,start,end);if(gated.dropped)throw Error('SEALED_VIEW_OUT_OF_BOUNDS');return JSON.parse(body.toString('utf8'));}
async function extractOne(source,page,out,start,end){
  const bytes=await fsp.readFile(source);if(sha(bytes)!==page.rawSha256)throw Error('SOURCE_SHA_BEFORE:'+page.filename);
  const gated=gateBytes(bytes,start,end),after=sha(await fsp.readFile(source));if(after!==page.rawSha256)throw Error('SOURCE_SHA_AFTER:'+page.filename);
  if(gated.retained)await fsp.writeFile(path.join(out,page.filename),gated.bytes,{flag:'wx'});
  return {filename:page.filename,symbol:page.symbol,interval:page.interval,sourceSha256Before:page.rawSha256,sourceSha256After:after,sourceRows:gated.total,retained:gated.retained,dropped:gated.dropped,spans:gated.spans,viewSha256:gated.retained?sha(gated.bytes):null};
}
module.exports={gateBytes,guardedRows,extractOne,sha};
