import {chromium} from 'playwright-core';
import {findBrowserExecutable} from './source-acquisition.js';

/** Render a complete escaped report offline, independently of screen pagination. */
export async function renderReportPdf(html:string):Promise<Buffer>{
 const executablePath=findBrowserExecutable();
 if(!executablePath)throw Error('PDF export requires Microsoft Edge or Google Chrome. HTML export remains available.');
 const browser=await chromium.launch({executablePath,headless:true,timeout:30_000});
 const deadline=setTimeout(()=>void browser.close().catch(()=>{}),60_000);
 try{
  const context=await browser.newContext({javaScriptEnabled:false,serviceWorkers:'block',offline:true});
  await context.route('**/*',route=>route.abort());
  const page=await context.newPage();
  const printStyle='@media print{body{font-size:10pt;line-height:1.5;margin:0;padding:0;max-width:none;color:#17251d}section{break-inside:auto;padding:12pt 0}h1,h2,h3{break-after:avoid}p,blockquote{orphans:3;widows:3}blockquote,small{overflow-wrap:anywhere}dl{display:grid;grid-template-columns:3fr 1fr}dd{margin:0}}';
  await page.setContent(html.replace('</html>','<style>'+printStyle+'</style></html>'),{waitUntil:'domcontentloaded',timeout:15_000});
  return await page.pdf({format:'A4',printBackground:true,margin:{top:'16mm',bottom:'20mm',left:'16mm',right:'16mm'},displayHeaderFooter:true,headerTemplate:'<span></span>',footerTemplate:'<div style="font:9px sans-serif;text-align:center;width:100%">Research’Ed · <span class="pageNumber"></span> / <span class="totalPages"></span></div>'});
 }finally{clearTimeout(deadline);await browser.close();}
}


