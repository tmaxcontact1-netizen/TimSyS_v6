import {describe,it,expect,vi} from 'vitest';
import {ContentWorker} from '../src/application/content-worker.js';
const source=(status:number,bytes:string)=>({requestedUrl:'https://example.edu/program',resolvedUrl:'https://archive.example.org/program',status,mediaType:'text/html',bytes:Buffer.from(bytes),hash:'retained-hash',metadata:{}});
function worker(fail=false){
 const acquire=vi.fn().mockResolvedValue(source(202,'<script src="challenge.js"></script>'));
 const render=fail?vi.fn().mockRejectedValue(new Error('browser_check_not_completed')):vi.fn().mockResolvedValue(source(200,'<main>Archived course content</main>'));
 const database={query:vi.fn().mockResolvedValue({rows:[{id:'snapshot'}]}),connect:vi.fn()};
 const w=new ContentWorker({database:database as any,storageRoot:'unused',acquire,render,getAiProvider:()=>null});
 vi.spyOn(w.repo,'source').mockResolvedValue({id:'source'} as any);
 vi.spyOn(w.archive,'beginRetrieval').mockResolvedValue(undefined as any);
 vi.spyOn(w.archive,'completeRetrieval').mockResolvedValue(undefined as any);
 vi.spyOn(w.archive,'failRetrieval').mockResolvedValue(undefined as any);
 return {w,render,database};
}
describe('content browser recovery',()=>{
 it('opens the resolved archive and retains original request and interim status',async()=>{const {w,render}=worker();const r=await (w as any).capture('workflow','http://example.edu/program',new AbortController().signal);expect(render).toHaveBeenCalledWith('https://archive.example.org/program',expect.objectContaining({waitForReadyPage:true}));expect(r.requestedUrl).toBe('http://example.edu/program');expect(r.metadata.httpStatus).toBe(202);expect(r.status).toBe(200);expect(w.archive.completeRetrieval).toHaveBeenCalledOnce()});
 it('does not retain a challenge when browser recovery fails',async()=>{const {w,database}=worker(true);await expect((w as any).capture('workflow','http://example.edu/program',new AbortController().signal)).rejects.toThrow('browser_check_not_completed');expect(database.query).not.toHaveBeenCalled();expect(w.archive.completeRetrieval).not.toHaveBeenCalled();expect(w.archive.failRetrieval).toHaveBeenCalledOnce()});
});
