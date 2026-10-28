const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  loadInstallerContract,
  readInstallerSource,
} = require("../scripts/installer-contract");
const root = path.join(__dirname, "..");
let statusCode = 200;
let contentType = "text/plain";
let replacement = null;
class MockRequest {
  constructor(url) {
    this.url = url;
  }
  async loadString() {
    this.response = { statusCode, headers: { "Content-Type": contentType } };
    return (
      replacement ??
      fs.readFileSync(
        path.join(root, path.basename(new URL(this.url).pathname)),
        "utf8"
      )
    );
  }
}
const contract = loadInstallerContract(readInstallerSource(), MockRequest);
const [main] = contract.CONFIG.resources;
const source = fs.readFileSync(
  path.join(root, "LoL-Esports-Schedule.js"),
  "utf8"
);
assert.equal(contract.CONFIG.resources.length, 1);
assert.equal(main.scriptName, "英雄联盟比赛赛程表");
assert.doesNotMatch(source, /\bimportModule\s*\(/);
async function verify() {
  assert.equal((await contract.downloadResource(main)).content, source);
  assert.doesNotThrow(() => contract.validateResourceContent(main, source));
  for (const [content, reason] of [
    [source.replace('name: "英雄联盟比赛赛程表"', 'name: "Other"'), /身份/],
    [
      source.replace(/\bversion: "\d+\.\d+\.\d+"/, 'version: "invalid"'),
      /版本/,
    ],
    [
      source.replace("// Variables used by Scriptable.", "// removed"),
      /metadata/,
    ],
    [source + '\nimportModule("LPL-Cito-Personal")', /辅助/],
    [
      source + "\nglobalThis.__LPL_SCHEDULE_DEV__ = { enabled: true };",
      /DEV bootstrap/,
    ],
    [`<html>${main.marker}</html>`, /JavaScript/],
  ])
    assert.throws(
      () => contract.validateResourceContent(main, content),
      reason
    );
  statusCode = 404;
  await assert.rejects(contract.downloadResource(main), /HTTP 404/);
  statusCode = 200;
  contentType = "text/html";
  await assert.rejects(contract.downloadResource(main), /类型/);
  contentType = "text/plain";
  replacement = "wrong resource";
  await assert.rejects(contract.downloadResource(main), /资源标识/);
  console.log("production installer contract: ok");
}
verify().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
