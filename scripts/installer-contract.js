const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadInstallerContract(source, Request) {
  const context = { Request };
  vm.runInNewContext(
    source.replace(
      /await main\(\);\s*$/,
      "globalThis.contract = { CONFIG, downloadResource, validateResourceContent };"
    ),
    context,
    { filename: "Installer.js" }
  );
  return context.contract;
}

function readInstallerSource() {
  return fs.readFileSync(path.join(__dirname, "..", "Installer.js"), "utf8");
}

module.exports = { loadInstallerContract, readInstallerSource };
