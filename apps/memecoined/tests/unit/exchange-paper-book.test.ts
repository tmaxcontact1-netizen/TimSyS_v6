import { describe,expect,it } from "vitest";
import { quoteTopOfBook } from "../../src/infrastructure/providers/exchange/paper-book.js";
const at=new Date("2026-10-03T17:00:00Z");
const book={venue:"binance" as const,venueSymbol:"BTCUSDT",eventTime:at,receivedAt:at,bidPrice:"100",bidQuantity:"2",askPrice:"101",askQuantity:"3"};
describe("exchange paper book",()=>{
 it("buys at ask with attributed fee",()=>{const q=quoteTopOfBook(book,"buy","2",10,at);expect(q.executionPrice).toBe("101");expect(q.fee).toBe("0.202");});
 it("sells at bid",()=>expect(quoteTopOfBook(book,"sell","2",0,at).executionPrice).toBe("100"));
 it("rejects quantities beyond evidenced top level",()=>expect(()=>quoteTopOfBook(book,"sell","3",0,at)).toThrow("cannot be executed"));
 it("rejects stale books",()=>expect(()=>quoteTopOfBook(book,"buy","1",0,new Date(at.valueOf()+2001))).toThrow("stale"));
 it("rejects invalid market and fee inputs",()=>{expect(()=>quoteTopOfBook({...book,askPrice:"99"},"buy","1",0,at)).toThrow();expect(()=>quoteTopOfBook(book,"buy","0",0,at)).toThrow();expect(()=>quoteTopOfBook(book,"buy","1",-1,at)).toThrow();});
});
