import { isAbsolute, resolve } from "node:path";

/** Resolves install-owned assets independently of the process working directory. */
export function resolveApplicationRoot(
  environment: NodeJS.ProcessEnv,
  fallbackDirectory: string = process.cwd(),
): string {
  const configured = environment.MEMECOINED_APP_ROOT;
  if (configured === undefined) return resolve(fallbackDirectory);
  if (!isAbsolute(configured)) throw new Error("MEMECOINED_APP_ROOT must be an absolute path");
  return resolve(configured);
}
