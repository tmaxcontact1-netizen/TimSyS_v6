const fs = require("node:fs");
const path = require("node:path");

// Electron Builder asks npm only for the production dependency tree. The
// launcher has no Node runtime dependencies: its renderer is bundled and each
// supervised application is staged separately with its own production modules.
const metadata = JSON.parse(
  fs.readFileSync(path.resolve("package.json"), "utf8"),
);
process.stdout.write(
  JSON.stringify({
    name: metadata.name,
    version: metadata.version,
    dependencies: {},
  }),
);
