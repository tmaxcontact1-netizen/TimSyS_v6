import {describe,it,expect} from "vitest";
import {createHash} from "node:crypto";
import {migrationHashes} from "../../scripts/migrate.js";
const hash=(text:string)=>createHash("sha256").update(text).digest("hex");
describe("historical migration checksums",()=>{
 it("accepts Windows and Unix line endings",()=>{
  const sql="BEGIN;\nSELECT 1;\nCOMMIT;\n";
  expect(migrationHashes(sql)).toContain(hash(sql.replace(/\n/g,"\r\n")));
  expect(migrationHashes(sql.replace(/\n/g,"\r\n"))).toContain(hash(sql));
 });
 it("rejects SQL, whitespace and final newline changes",()=>{
  for(const changed of ["SELECT 2;\n","SELECT  1;\n","SELECT 1;"])
   expect(migrationHashes("SELECT 1;\n")).not.toContain(hash(changed));
 });
});
