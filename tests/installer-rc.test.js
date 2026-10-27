const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { buildInstallerRcSource } = require("../scripts/build-installer-rc");
const { readInstallerSource } = require("../scripts/installer-contract");

const root = path.join(__dirname, "..");
const productionSource = readInstallerSource();
const widgetSource = fs.readFileSync(
  path.join(root, "LPL-Schedule.js"),
  "utf8"
);
const designSource = fs.readFileSync(
  path.join(root, "LPL-Design-System.js"),
  "utf8"
);
const rcSource = buildInstallerRcSource(
  productionSource,
  widgetSource,
  designSource
);
const files = new Map([
  ["/icloud/LPL Schedule.js", 'const APP = { version: "3.1.1" };'],
  ["/icloud/LPL Schedule 2026.js", 'const APP = { version: "3.1.0" };'],
  ["/icloud/LPL Schedule DEV.js", "existing DEV script"],
]);
const before = new Map(files);
let rejectInstaller = false;
let healthyRemoteInstaller = false;
const messages = [];
const context = {
  console,
  Request: class {
    constructor(url) {
      this.url = url;
    }
    async loadString() {
      this.response = {
        statusCode: 200,
        headers: { "Content-Type": "text/plain" },
      };
      const name = path.basename(new URL(this.url).pathname);
      if (rejectInstaller && name === "Installer.js") return "wrong resource";
      if (name === "Installer.js")
        return healthyRemoteInstaller
          ? productionSource
          : productionSource.replace(
              "function validateResourceContent(",
              "function legacyResourceValidation("
            );
      return fs.readFileSync(path.join(root, name), "utf8");
    }
  },
  FileManager: {
    iCloud: () => ({
      documentsDirectory: () => "/icloud",
      joinPath: (directory, name) => `${directory}/${name}`,
      fileExists: (target) => files.has(target),
      isFileDownloaded: () => true,
      readString: (target) => files.get(target),
      writeString: (target, content) => files.set(target, content),
      remove: (target) => files.delete(target),
    }),
  },
  Alert: class {
    addAction() {}
    addCancelAction() {}
    async present() {
      messages.push(this.title);
      return 0;
    }
  },
  Safari: { open() {} },
  Script: { complete() {} },
};
vm.runInNewContext(
  rcSource.replace(/await main\(\);\s*$/, "globalThis.runInstaller = main;"),
  context
);

async function verify() {
  rejectInstaller = true;
  await context.runInstaller();
  assert.equal(messages.at(-1), "安装失败");
  assert.deepEqual(
    files,
    before,
    "validation failure must preserve all existing scripts"
  );
  rejectInstaller = false;
  await context.runInstaller();
  assert.equal(messages.at(-1), "安装完成");
  assert.equal(files.get("/icloud/LPL Schedule.js"), widgetSource);
  assert.equal(files.get("/icloud/LPL Schedule 2026.js"), widgetSource);
  assert.equal(files.get("/icloud/LPL-Design-System.js"), designSource);
  assert.equal(files.get("/icloud/LPL Schedule Installer.js"), rcSource);
  assert.equal(
    files.get("/icloud/LPL Schedule DEV.js"),
    before.get("/icloud/LPL Schedule DEV.js")
  );
  await context.runInstaller();
  assert.equal(messages.at(-1), "安装完成");
  assert.equal(files.get("/icloud/LPL Schedule Installer.js"), rcSource);
  assert.equal(
    files.size,
    7,
    "repeat installation must not create duplicate scripts"
  );
  healthyRemoteInstaller = true;
  await context.runInstaller();
  assert.equal(messages.at(-1), "安装完成");
  assert.equal(
    files.get("/icloud/LPL Schedule Installer.js"),
    productionSource
  );
  console.log("installer RC: ok");
}

verify().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
