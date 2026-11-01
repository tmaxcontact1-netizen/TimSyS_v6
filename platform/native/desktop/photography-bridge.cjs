'use strict';
const {createHash}=require('node:crypto');
const operations=new Set(['profiles','profile_create','profile_retire','images','fingerprint','fingerprint_generate','fingerprint_decide','upload_abort']);
async function binary(client,method,suffix,bytes){const token=await client.getToken();const response=await fetch(client.baseUrl+'/api/timsys/v1/apps/dressed/services/photography/contracts/1.0.0/'+suffix,{method,redirect:'error',headers:{Authorization:'Bearer '+token,...(bytes?{'Content-Type':'application/octet-stream','Content-Length':String(bytes.length)}:{})},body:bytes,signal:AbortSignal.timeout(30000)});if(!response.ok){const data=await response.json();throw Object.assign(Error(data.error?.message||'Photography request failed'),{code:data.error?.code,status:response.status});}if(method==='PUT')return response.json();const parts=[];let length=0;for await(const part of response.body){length+=part.length;if(length>25000000)throw Error('Image exceeds transfer limit');parts.push(part);}return{bytes:new Uint8Array(Buffer.concat(parts)),mediaType:response.headers.get('content-type')};}
function createPhotographyBridge({authorize,client}){return async(event,value)=>{
 if(!authorize(event))throw Error('Dress’Ed main frame required');
 try{const service=await client();if(value?.kind==='content'){if(!/^[0-9a-f-]{36}$/i.test(value.imageId))throw Error('Invalid image');return{success:true,data:await binary(service,'GET','images/'+value.imageId+'/content')};}
  if(value?.kind==='upload'){
   if(!(value.bytes instanceof Uint8Array)||value.bytes.length<1||value.bytes.length>25000000||! /^[a-zA-Z0-9_-]{16,80}$/.test(value.idempotencyKey))throw Error('Invalid upload');const bytes=Buffer.from(value.bytes),metadata={...value.metadata,byteSize:bytes.length,contentHash:createHash('sha256').update(bytes).digest('hex')};
   const begun=await service.invoke('photography','1.0.0','upload_begin',metadata,{idempotencyKey:value.idempotencyKey+'_begin'}),id=begun.data.uploadId;
   try{await binary(service,'PUT','uploads/'+id+'/content',bytes);return await service.invoke('photography','1.0.0','upload_commit',{uploadId:id},{idempotencyKey:value.idempotencyKey+'_commit'});}catch(error){if(error.status>=400&&error.status<500&&![408,409,429,499].includes(error.status))await service.invoke('photography','1.0.0','upload_abort',{uploadId:id},{idempotencyKey:value.idempotencyKey+'_abort'}).catch(()=>{});throw error;}
  }
  if(!value||!operations.has(value.operation)||Buffer.byteLength(JSON.stringify(value.input))>32768)throw Error('Invalid photography operation');return await service.invoke('photography','1.0.0',value.operation,value.input,{idempotencyKey:value.idempotencyKey});
 }catch(error){return{success:false,error:{code:error.code||'PHOTOGRAPHY_UNAVAILABLE',message:error.code?error.message:'TimSyS photography is unavailable',status:error.status||0}};}
};}
function assertPhotographyDeclaration(value){if(value?.appId!=='dressed'||value.protocol!=='timsys.services.v1'||!value.contracts?.some(c=>c.serviceId==='photography'&&c.version==='1.0.0'&&c.operations?.includes('upload_commit')))throw Error('Update Dress’Ed before starting the TimSyS photography service');}
module.exports={createPhotographyBridge,assertPhotographyDeclaration};
