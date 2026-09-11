import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
const read = (path) => readFileSync(resolve(root, path), "utf8");
const failures = [];
const sources = {
  launcher: ["apps/launcher/src/index.jsx", "apps/launcher/src/App.jsx", "apps/launcher/src/pages/AppDashboard.jsx"],
  principaled: ["apps/principaled/src/main.jsx", "apps/principaled/src/api/client.js", "apps/principaled/src/dashboard/Index.jsx"],
  dressed: ["apps/dressed/frontend/src/main.jsx"],
  researched: ["apps/researched/frontend/src/main.jsx"],
  memecoined: ["apps/memecoined/frontend/app.js", "apps/memecoined/frontend/index.html"],
};
const all = Object.values(sources).flat().map(read).join("\n");
if (/window\.(alert|confirm|prompt)\s*\(/.test(all)) failures.push("native browser prompt/confirm/alert remains in a user interface");
for (const app of ["launcher", "principaled", "dressed", "researched"]) {
  if (!sources[app].map(read).join("\n").includes("ActionFeedbackHost")) failures.push(`${app} does not mount the shared action-feedback host`);
}
if (!sources.memecoined.map(read).join("\n").includes("installActionFeedback")) failures.push("memecoined does not install mutation feedback");
const contract = JSON.parse(read("platform/shared/contracts/application-ui-standard.json"));
for (const requirement of ["successAndErrorFeedback", "loadingFeedback", "mutationFeedbackHost", "silentCompletionForbidden"]) if (contract.actions?.[requirement] !== true) failures.push(`UI contract does not require ${requirement}`);
const sharedStyles = read("apps/shared-ui/styles/timsys-dark.css");
if (!sharedStyles.includes(":focus-visible")) failures.push("shared UI has no visible keyboard focus treatment");
if (!sharedStyles.includes("prefers-reduced-motion")) failures.push("shared UI does not respect reduced-motion preference");
const pagination = read("apps/shared-ui/react/pagination.jsx");
if (!pagination.includes('aria-current="page"') || !pagination.includes("Showing ${first}–${last} of ${total}")) failures.push("shared pagination does not expose location and result range");
const interactions = read("docs/UI_INTERACTION_STANDARD.md");
for (const phrase of ["Silent completion is forbidden", "preserve a local draft", "explicit confirmation", "maximum of 50 rows", "links to the underlying records"]) if (!interactions.includes(phrase)) failures.push(`interaction standard is missing: ${phrase}`);
if (failures.length) {
  console.error(`GUI practice audit failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("GUI practice audit passed: five applications, mutation feedback, safe dialogs, focus, motion, pagination, and interaction contracts verified.");
