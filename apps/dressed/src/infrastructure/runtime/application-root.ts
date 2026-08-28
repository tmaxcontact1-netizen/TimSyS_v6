import { isAbsolute, resolve } from "node:path";

export function applicationRoot(environment: NodeJS.ProcessEnv): string {
  const configured = environment.DRESSED_APP_ROOT;
  if (configured === undefined) return resolve(process.cwd());
  if (!isAbsolute(configured)) throw new Error("DRESSED_APP_ROOT must be absolute");
  return resolve(configured);
}

