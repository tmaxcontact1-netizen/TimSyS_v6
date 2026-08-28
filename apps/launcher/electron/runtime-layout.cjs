const path = require('node:path');

function createRuntimeLayout({ packaged, resourcesPath, userDataPath, sourceRoot }) {
  const resourceRoot = packaged ? resourcesPath : sourceRoot;
  return Object.freeze({
    resourceRoot,
    platformRoot: path.join(resourceRoot, 'platform'),
    principaledRoot: path.join(resourceRoot, 'apps', 'principaled'),
    memecoinedRoot: path.join(resourceRoot, 'apps', 'memecoined'),
    dressedRoot: path.join(resourceRoot, 'apps', 'dressed'),
    postgresRoot: path.join(resourceRoot, 'runtime', 'postgres'),
    launcherUi: packaged ? path.join(resourcesPath, 'launcher-ui') : null,
    dataRoot: userDataPath,
    platformData: path.join(userDataPath, 'platform'),
    memecoinedData: path.join(userDataPath, 'memecoined'),
    dressedData: path.join(userDataPath, 'dressed'),
  });
}

module.exports = { createRuntimeLayout };
