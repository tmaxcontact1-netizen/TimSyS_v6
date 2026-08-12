import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { isAbsolute } from "node:path";

import { z } from "zod";

import type { WalletSecretSource } from "./local-signer.js";

const keypairSchema = z.array(z.number().int().min(0).max(255)).length(64);
const MAXIMUM_SECRET_BYTES = 1_024;

/** Reads one dedicated keypair file without following links or accepting broad permissions. */
export class RestrictedWalletSecretFile implements WalletSecretSource {
  public constructor(private readonly path: string) {
    if (!isAbsolute(path)) throw new Error("Wallet secret path must be absolute");
  }

  public async loadKeypairBytes(): Promise<Readonly<Uint8Array>> {
    const linkMetadata = await lstat(this.path);
    if (linkMetadata.isSymbolicLink()) throw new Error("Wallet secret must not be a symbolic link");
    const handle = await open(this.path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const metadata = await handle.stat();
      if (!metadata.isFile()) throw new Error("Wallet secret must be a regular file");
      const runtimeUserId = process.getuid?.();
      if (runtimeUserId !== undefined) {
        if (metadata.uid !== runtimeUserId)
          throw new Error("Wallet secret must be owned by the runtime user");
        if ((metadata.mode & 0o077) !== 0)
          throw new Error("Wallet secret permissions must exclude group and other access");
      }
      if (metadata.size < 2 || metadata.size > MAXIMUM_SECRET_BYTES)
        throw new Error("Wallet secret file size is invalid");
      const contents = await handle.readFile({ encoding: "utf8" });
      let raw: unknown;
      try {
        raw = JSON.parse(contents) as unknown;
      } catch {
        throw new Error("Wallet secret is not valid JSON");
      }
      const parsed = keypairSchema.safeParse(raw);
      if (!parsed.success) throw new Error("Wallet secret must contain exactly 64 bytes");
      return new Uint8Array(parsed.data);
    } finally {
      await handle.close();
    }
  }
}
