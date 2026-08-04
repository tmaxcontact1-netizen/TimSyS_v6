import { chmod, mkdir, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { RestrictedWalletSecretFile } from "../../src/infrastructure/security/secret-provider.js";

const roots: string[] = [];

async function root(): Promise<string> {
  const path = join(tmpdir(), `memecoined-secret-${crypto.randomUUID()}`);
  await mkdir(path, { mode: 0o700 });
  roots.push(path);
  return path;
}

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("restricted wallet secret file", () => {
  it("loads an owner-only 64-byte JSON keypair", async () => {
    const path = join(await root(), "wallet.json");
    await writeFile(path, JSON.stringify(Array.from({ length: 64 }, (_, index) => index)), {
      mode: 0o600,
    });
    await expect(new RestrictedWalletSecretFile(path).loadKeypairBytes()).resolves.toEqual(
      new Uint8Array(Array.from({ length: 64 }, (_, index) => index)),
    );
  });

  it("rejects broad permissions", async () => {
    const path = join(await root(), "wallet.json");
    await writeFile(path, JSON.stringify(new Array(64).fill(1)), { mode: 0o600 });
    await chmod(path, 0o640);
    await expect(new RestrictedWalletSecretFile(path).loadKeypairBytes()).rejects.toThrow(
      /permissions/,
    );
  });

  it("rejects symlinks and malformed keypairs", async () => {
    const directory = await root();
    const target = join(directory, "wallet.json");
    const link = join(directory, "wallet-link.json");
    await writeFile(target, JSON.stringify([1, 2, 3]), { mode: 0o600 });
    await symlink(target, link);
    await expect(new RestrictedWalletSecretFile(link).loadKeypairBytes()).rejects.toThrow();
    await expect(new RestrictedWalletSecretFile(target).loadKeypairBytes()).rejects.toThrow(
      /64 bytes/,
    );
  });

  it("requires an absolute path", () =>
    expect(() => new RestrictedWalletSecretFile("wallet.json")).toThrow(/absolute/));
});
