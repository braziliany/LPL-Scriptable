const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { buildInstallerRcSource } = require("../scripts/build-installer-rc");
const { readInstallerSource } = require("../scripts/installer-contract");
const root = path.join(__dirname, "..");
const widget = fs.readFileSync(
  path.join(root, "LoL-Esports-Schedule.js"),
  "utf8"
);
const files = new Map([
  ["/icloud/LPL Schedule 2026.js", "old"],
  ["/icloud/LPL Schedule DEV.js", "dev"],
]);
const context = {
  console,
  Request: class {
    constructor() {
      throw new Error("candidate requested network");
    }
  },
  FileManager: {
    iCloud: () => ({
      documentsDirectory: () => "/icloud",
      joinPath: (dir, name) => `${dir}/${name}`,
      fileExists: (target) => files.has(target),
      isFileDownloaded: () => true,
      readString: (target) => files.get(target),
      writeString: (target, value) => files.set(target, value),
      remove: (target) => files.delete(target),
    }),
  },
  Alert: class {
    addAction() {}
    addCancelAction() {}
    async present() {
      return 0;
    }
  },
  Safari: { open() {} },
  Script: { complete() {} },
};
const source = buildInstallerRcSource(readInstallerSource(), widget);
vm.runInNewContext(
  source.replace(/await main\(\);\s*$/, "globalThis.runInstaller = main;"),
  context
);
async function verify() {
  await context.runInstaller();
  assert.equal(files.get("/icloud/英雄联盟比赛赛程表.js"), widget);
  assert.equal(files.get("/icloud/LPL Schedule 2026.js"), widget);
  assert.equal(files.get("/icloud/LPL Schedule DEV.js"), "dev");
  const size = files.size;
  await context.runInstaller();
  assert.equal(files.size, size);
  console.log("installer RC: ok");
}
verify().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
