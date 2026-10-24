import {it,expect,vi} from 'vitest';
import {McfAiWorker} from '../src/application/mcf-ai.js';
function gate(){let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return{promise,resolve};}
it('caps overlapping ticks at two lanes and refills the free lane without waiting for its peer',async()=>{
 const worker=new McfAiWorker({} as any,()=>null),gates=[gate(),gate(),gate()];let count=0;
 vi.spyOn(worker,'process').mockImplementation(async()=>{const i=count++;if(gates[i])await gates[i].promise;});vi.spyOn(worker,'settle').mockResolvedValue();
 const first=worker.tick();await Promise.resolve();expect(count).toBe(2);
 const overlap=worker.tick();await Promise.resolve();expect(count).toBe(2);
 gates[0]!.resolve();await vi.waitFor(()=>expect((worker as any).active.size).toBe(1));
 const refill=worker.tick();await Promise.resolve();expect(count).toBe(3);
 worker.stop();gates[1]!.resolve();gates[2]!.resolve();await Promise.all([first,overlap,refill]);await worker.tick();expect(count).toBe(3);
});
it('a rejected lane does not block its peer or subsequent work',async()=>{
 const worker=new McfAiWorker({} as any,()=>null),gate2=gate();let count=0;
 vi.spyOn(worker,'process').mockImplementation(async()=>{if(++count===1)throw Error('fixture');if(count===2)await gate2.promise;});vi.spyOn(worker,'settle').mockResolvedValue();
 const first=worker.tick();await vi.waitFor(()=>expect((worker as any).active.size).toBe(1));const next=worker.tick();await Promise.resolve();expect(count).toBe(3);worker.stop();gate2.resolve();await Promise.all([first,next]);
});

