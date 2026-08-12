import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const version = "18.4-1";
const source = "https://sbp.enterprisedb.com/getfile.jsp?fileid=1260303";
const expectedSha256 = "02e239529ed7833d169f98d915d3feffe0813264b08b3ae353e78e8b9c97e1a6";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cache = join(root, "apps", "launcher", ".cache");
const archive = join(cache, `postgresql-${version}-windows-x64-binaries.zip`);
const destination = join(cache, "postgres");

async function sha256(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}
async function extract() {
  const temporary = join(cache, "postgres-extract");
  await rm(temporary, { recursive: true, force: true });
  await mkdir(temporary, { recursive: true });
  await new Promise((success, failure) => {
    const child = spawn("tar.exe", ["-xf", archive, "-C", temporary], { stdio: "inherit" });
    child.once("error", failure);
    child.once("exit", (code) => code === 0 ? success() : failure(new Error(`PostgreSQL extraction failed with ${code}`)));
  });
  await rm(destination, { recursive: true, force: true });
  await rename(join(temporary, "pgsql"), destination);
  await rm(temporary, { recursive: true, force: true });
}

await mkdir(cache, { recursive: true });
try { await access(join(destination, "bin", "postgres.exe")); process.exit(0); } catch {}
try { await access(archive); }
catch {
  const response = await fetch(source);
  if (!response.ok || !response.body) throw new Error(`PostgreSQL download failed: ${response.status}`);
  const partial = archive + ".partial";
  await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));
  await rename(partial, archive);
}
const actual = await sha256(archive);
if (expectedSha256 !== "TO_BE_RECORDED" && actual !== expectedSha256) throw new Error("PostgreSQL archive checksum mismatch");
await writeFile(archive + ".sha256", `${actual}  ${archive}\n`);
await extract();
process.stdout.write(`PostgreSQL ${version} ready (${actual})\n`);
