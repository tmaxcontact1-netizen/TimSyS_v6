import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, normalize, relative, resolve } from "node:path";

export class PrivateImageStore {
  private readonly root: string;
  public constructor(root: string) { this.root = resolve(root, "images"); }

  public async writeOriginal(input: { garmentId: string; imageId: string; extension: ".jpg" | ".png"; bytes: Buffer }): Promise<string> {
    const relativePath = join(input.garmentId, input.imageId, `original${input.extension}`);
    const absolute = resolve(this.root, relativePath);
    if (!this.contains(absolute)) throw new Error("image_path_escape");
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, input.bytes, { flag: "wx" });
    return relativePath.replaceAll("\\", "/");
  }

  public async read(relativePath: string): Promise<Buffer> {
    if (isAbsolute(relativePath) || relativePath.includes("\0")) throw new Error("invalid_image_path");
    const absolute = resolve(this.root, normalize(relativePath));
    if (!this.contains(absolute)) throw new Error("invalid_image_path");
    return readFile(absolute);
  }

  public async removeOriginal(relativePath: string): Promise<void> {
    if (isAbsolute(relativePath) || relativePath.includes("\0")) throw new Error("invalid_image_path");
    const absolute = resolve(this.root, normalize(relativePath));
    if (!this.contains(absolute)) throw new Error("invalid_image_path");
    await rm(dirname(absolute), { recursive: true, force: true });
  }

  public async removeGarment(garmentId: string): Promise<void> {
    if (!/^[0-9a-f-]{36}$/i.test(garmentId)) throw new Error("invalid_garment_id");
    const absolute = resolve(this.root, garmentId);
    if (!this.contains(absolute)) throw new Error("image_path_escape");
    await rm(absolute, { recursive: true, force: true });
  }

  private contains(absolute: string): boolean {
    const value = relative(this.root, absolute);
    return value !== ".." && !value.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) && !isAbsolute(value);
  }
}
