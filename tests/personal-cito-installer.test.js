const assert = require("node:assert/strict");
const vm = require("node:vm");
const { installer } = require("../scripts/build-personal-cito-installer");

const files = new Map([["/icloud/LPL Schedule 2026.js", "old"]]);
const alerts = [];
const context = {
  console,
  FileManager: {
    iCloud: () => ({
      documentsDirectory: () => "/icloud",
      joinPath: (folder, name) => `${folder}/${name}`,
      fileExists: (target) => files.has(target),
      isFileDownloaded: () => true,
      readString: (target) => files.get(target),
      writeString: (target, value) => files.set(target, value),
      remove: (target) => files.delete(target),
    }),
  },
  Alert: class {
    async present() {
      alerts.push(this.title);
      return 0;
    }
    addAction() {}
    addCancelAction() {}
  },
  Safari: { open() {} },
  Script: { complete() {} },
  Request: class {
    constructor() {
      throw new Error("offline package requested network");
    }
  },
};
vm.runInNewContext(
  installer.replace(/await main\(\);\s*$/, "globalThis.runInstaller = main;"),
  context
);
context
  .runInstaller()
  .then(() => {
    assert.equal(alerts[0], "安装 Worlds Cito 个人版");
    assert.equal(alerts.at(-1), "安装完成");
    for (const name of [
      "LPL-Design-System",
      "LPL Schedule 2026",
      "LPL-Cito-Worlds",
      "LPL-Cito-Personal",
      "LPL Schedule Installer",
    ]) {
      assert.ok(files.has(`/icloud/${name}.js`), `${name} not installed`);
    }
    assert.equal(
      files.get("/icloud/LPL Schedule 2026.js").includes('version: "3.1.4"'),
      true
    );
    assert.equal(
      files.get("/icloud/LPL-Cito-Personal.js").includes("x-api-key"),
      true
    );
    assert.doesNotMatch(installer, /CITO_API_KEY\s*=/);
    console.log("personal Cito offline installer: ok");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
