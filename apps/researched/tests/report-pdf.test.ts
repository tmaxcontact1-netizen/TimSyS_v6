import {describe,it,expect} from 'vitest';
import {createServer} from 'node:http';
import {createReportPdfApi} from '../src/entrypoints/report-pdf-api.js';
// @ts-ignore browser module
import {reportHtml} from '../frontend/src/workbench/report.js';
describe('PDF export',()=>{
 it('exports all passages independently of screen pagination with escaped text and limitations after findings',()=>{
  const units=Array.from({length: forty},(_,i)=>({id:'unit'+i,session_ordinal:i+1,filename:'source.txt',original_text:'Evidence '+i}));
  const html=reportHtml({tool:'mcf',draft:{useAi:false,title:'Pilot <2>',decisions:Object.fromEntries(units.map(u=>[u.id,{codes:[],notes:'Review'}]))},session:{units},instrument:{competencies:[]},machine:{}});
  for(const u of units)expect(html).toContain(u.original_text);
  expect(html).toContain('Pilot &lt;2&gt;');
 });
 it('returns PDF bytes, blocks cross-origin requests and rejects invalid input without rendering',async()=>{
  let calls=0;const handler=createReportPdfApi(async()=>{calls++;return Buffer.from('%PDF-1.7\nfixture');});
  const server=createServer((q,r)=>{void handler(q,r);});await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address() as {port:number};const url=`http://127.0.0.1:${address.port}/api/reports/pdf`;
  try{
   expect((await fetch(url)).status).toBe(405);
   expect((await fetch(url,{method:'POST',headers:{origin:'https://other.example'},body:'{}'})).status).toBe(403);
   expect((await fetch(url,{method:'POST',body:'{}'})).status).toBe(400);
   const r=await fetch(url,{method:'POST',body:JSON.stringify({html:'<!doctype html><p>Report</p>'})});expect(r.headers.get('content-type')).toBe('application/pdf');expect(await r.text()).toBe('%PDF-1.7\nfixture');expect(calls).toBe(1);
  }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
 });
});
const forty=40;
