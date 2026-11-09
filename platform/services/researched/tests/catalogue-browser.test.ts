import {describe,it,expect,vi,beforeEach} from 'vitest';
const mock=vi.hoisted(()=>({initialStatus:202,finalStatus:200,pending:true,handler:null as any,closed:false,clock:0}));
vi.mock('node:dns/promises',()=>({lookup:async()=>[{address:'93.184.216.34',family:4}]}));
vi.mock('node:fs',()=>({existsSync:()=>true}));
vi.mock('playwright-core',()=>({chromium:{launch:async()=>({close:async()=>{mock.closed=true},newContext:async()=>({newPage:async()=>page})})}}));
const response=(status:number)=>({status:()=>status,ok:()=>status>=200&&status<300,url:()=> 'https://archive.example.edu/program',request:()=>({isNavigationRequest:()=>true}),frame:()=>frame});
const frame={};
const page={mainFrame:()=>frame,on:(_:string,handler:any)=>{mock.handler=handler},route:async()=>{},goto:async()=>{const r=response(mock.initialStatus);mock.handler(r);return r},evaluate:async()=>mock.pending,waitForTimeout:async()=>{mock.clock+=250;mock.pending=mock.finalStatus===202;mock.handler(response(mock.finalStatus))},waitForLoadState:async()=>{},locator:()=>({count:async()=>mock.pending?1:0}),content:async()=>'<main>Archived programme curriculum and course descriptions</main>',url:()=> 'https://archive.example.edu/program',title:async()=> 'Archived programme'};
import {acquireRenderedSource} from '../src/application/source-acquisition.js';
beforeEach(()=>{Object.assign(mock,{initialStatus:202,finalStatus:200,pending:true,closed:false,clock:0});vi.spyOn(Date,'now').mockImplementation(()=>mock.clock)});
describe('catalogue browser readiness',()=>{
 it('waits for browser-check reload and records final response and navigation provenance',async()=>{const r=await acquireRenderedSource('https://example.edu/program',{waitForReadyPage:true,expandInteractiveContent:false,timeoutMs:1000});expect(r.status).toBe(200);expect(r.requestedUrl).toBe('https://example.edu/program');expect(r.resolvedUrl).toBe('https://archive.example.edu/program');expect(r.metadata.navigations).toHaveLength(2);expect(mock.closed).toBe(true)});
 it('does not save an unresolved browser check as programme evidence',async()=>{mock.finalStatus=202;await expect(acquireRenderedSource('https://example.edu/program',{waitForReadyPage:true,expandInteractiveContent:false,timeoutMs:500})).rejects.toThrow('browser_check_not_completed');expect(mock.closed).toBe(true)});
 it('retains a real missing-page error after waiting',async()=>{mock.finalStatus=404;await expect(acquireRenderedSource('https://example.edu/program',{waitForReadyPage:true,expandInteractiveContent:false,timeoutMs:500})).rejects.toMatchObject({status:404})});
 it('honours cancellation without accepting interim content',async()=>{const c=new AbortController();c.abort();await expect(acquireRenderedSource('https://example.edu/program',{waitForReadyPage:true,signal:c.signal})).rejects.toThrow('capture_cancelled');expect(mock.closed).toBe(true)});
});
