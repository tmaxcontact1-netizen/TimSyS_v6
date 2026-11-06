const path = require('node:path');

function createRuntimeLayout({ packaged, resourcesPath, userDataPath, sourceRoot, bundleRoots = {} }) {
  const resourceRoot = packaged ? resourcesPath : sourceRoot;
  const bundled = (id, fallback) => packaged && bundleRoots[id] ? bundleRoots[id] : fallback;
  return Object.freeze({
    resourceRoot,
    platformRoot: bundled('platform', path.join(resourceRoot, 'platform')),
    principaledRoot: bundled('principaled', path.join(resourceRoot, 'apps', 'principaled')),
    tradeedRoot: bundled('tradeed', path.join(resourceRoot, 'apps', 'tradeed')),
    dressedRoot: bundled('dressed', path.join(resourceRoot, 'apps', 'dressed')),
    researchedRoot: bundled('researched', path.join(resourceRoot, 'apps', 'researched')),
    postgresRoot: path.join(resourceRoot, 'runtime', 'postgres'),
    launcherUi: packaged ? bundled('launcher-ui', path.join(resourcesPath, 'launcher-ui')) : null,
    dataRoot: userDataPath,
    databaseData: path.join(userDataPath, 'shared-database'),
    platformData: path.join(userDataPath, 'platform'),
    dressedData: path.join(userDataPath, 'dressed'),
    researchedData: path.join(userDataPath, 'researched'),
  });
}

module.exports = { createRuntimeLayout };
