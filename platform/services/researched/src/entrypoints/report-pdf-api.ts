import type {IncomingMessage,ServerResponse} from 'node:http';
import {renderReportPdf} from '../application/report-pdf.js';

export function createReportPdfApi(render=renderReportPdf){
 let busy=false;
 return async(q:IncomingMessage,r:ServerResponse)=>{
  if(new URL(q.url??'/','http://localhost').pathname!=='/api/reports/pdf')return false;
  const error=(status:number,message:string)=>{r.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});r.end(JSON.stringify({error:message}));};
  if(q.method!=='POST'){error(405,'POST required');return true;}
  if(q.headers.origin&&q.headers.origin!==`http://${q.headers.host}`){error(403,'origin_not_allowed');return true;}
  if(busy){error(409,'A PDF is already being prepared. Please try again shortly.');return true;}
  busy=true;
  try{
   let size=0;const chunks:Buffer[]=[];
   for await(const part of q){const b=Buffer.from(part);size+=b.length;if(size>12_000_000){error(413,'Report exceeds PDF export size limit. Use HTML export.');return true;}chunks.push(b);}
   const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   if(typeof input.html!=='string'||!input.html.startsWith('<!doctype html>')){error(400,'Invalid report');return true;}
   const pdf=await render(input.html);
   r.writeHead(200,{'content-type':'application/pdf','content-disposition':'attachment; filename="ResearchEd.pdf"','content-length':pdf.length,'cache-control':'no-store'});r.end(pdf);
  }catch(e){error(400,e instanceof Error?e.message:'PDF export failed');}finally{busy=false;}
  return true;
 };
}
