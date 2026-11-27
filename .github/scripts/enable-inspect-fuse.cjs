// Playwright drives Electron through the Node inspector, which the published build has fused off.
// The test runs on a copy of the packaged app with only that fuse turned back on.
const path = require("path");
const { createRequire } = require("module");

// @electron/fuses is only installed as a dependency of electron-builder.
const fromDesktop = createRequire(path.join(process.env.T3_REPO, "apps/desktop/package.json"));
const fromElectronBuilder = createRequire(fromDesktop.resolve("electron-builder/package.json"));
const fromBuilder = createRequire(fromElectronBuilder.resolve("app-builder-lib/package.json"));
const { flipFuses, getCurrentFuseWire, FuseVersion, FuseV1Options } = fromBuilder("@electron/fuses");

const exe = process.argv[2];
const fuse = FuseV1Options.EnableNodeCliInspectArguments;
const ENABLED = "1".charCodeAt(0);

flipFuses(exe, { version: FuseVersion.V1, [fuse]: true })
  .then(() => getCurrentFuseWire(exe))
  .then((wire) => {
    if (wire[fuse] !== ENABLED) throw new Error("The inspector fuse did not turn on.");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
