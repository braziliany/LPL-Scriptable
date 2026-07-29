const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const installerPath = path.join(__dirname, "..", "Installer.js");
const source = fs
  .readFileSync(installerPath, "utf8")
  .replace(
    "await main();",
    "globalThis.__installerTestApi = { CONFIG };"
  );
const context = {};
vm.runInNewContext(source, context, { filename: installerPath });

const resources = JSON.parse(
  JSON.stringify(context.__installerTestApi.CONFIG.resources)
);
assert.deepEqual(
  resources.map((resource) => resource.scriptName),
  [
    "LPL-Design-System",
    "LPL Schedule 2026",
    "LPL Schedule Installer",
  ]
);
assert.match(resources[0].sourceUrl, /LPL-Design-System\.js$/);
assert.match(resources[1].sourceUrl, /LPL-Schedule\.js$/);
assert.match(resources[2].sourceUrl, /Installer\.js$/);

console.log("installer: ok");
