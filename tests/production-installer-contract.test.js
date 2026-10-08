const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  loadInstallerContract,
  readInstallerSource,
} = require("../scripts/installer-contract");

const root = path.join(__dirname, "..");
let statusCode = 200;
let contentType = "text/plain; charset=utf-8";
let replacement = null;
class MockRequest {
  constructor(url) {
    this.url = url;
  }
  async loadString() {
    assert.equal(this.timeoutInterval, 20);
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
const main = contract.CONFIG.resources[1];
const mainSource = fs.readFileSync(path.join(root, "LPL-Schedule.js"), "utf8");
// Preserve the real v3.1.1 trigger: the obsolete literal is absent.
assert.equal(mainSource.includes('importModule("LPL-Design-System")'), false);

async function verify() {
  for (const resource of contract.CONFIG.resources) {
    assert.match(
      resource.sourceUrl,
      /^https:\/\/raw\.githubusercontent\.com\/braziliany\/LPL-Scriptable\/main\//
    );
    const downloaded = await contract.downloadResource(resource);
    assert.equal(
      downloaded.content,
      fs.readFileSync(
        path.join(root, path.basename(new URL(resource.sourceUrl).pathname)),
        "utf8"
      )
    );
  }
  const directImport = mainSource.replace(
    /importModule\(\s*IS_DEV \? DEV_RUNTIME\.designSystemModule : "LPL-Design-System"\s*\)/,
    'importModule("LPL-Design-System")'
  );
  assert.doesNotThrow(() =>
    contract.validateResourceContent(main, directImport)
  );
  for (const [content, reason] of [
    [
      mainSource.replace('name: "LPL Schedule"', 'name: "Other widget"'),
      /身份/,
    ],
    [
      mainSource.replace(/\bversion: "\d+\.\d+\.\d+"/, 'version: "invalid"'),
      /版本/,
    ],
    [
      mainSource.replace("// Variables used by Scriptable.", "// removed"),
      /metadata/,
    ],
    [
      mainSource.replace(
        'DEV_RUNTIME.designSystemModule : "LPL-Design-System"',
        'DEV_RUNTIME.designSystemModule : "Other-System"'
      ),
      /导入/,
    ],
    [
      `${mainSource}\nglobalThis.__LPL_SCHEDULE_DEV__ = { enabled: true };`,
      /DEV bootstrap/,
    ],
    [`<html>${main.marker}</html>`, /JavaScript/],
  ]) {
    assert.throws(
      () => contract.validateResourceContent(main, content),
      reason
    );
  }
  const design = contract.CONFIG.resources[0];
  const designSource = fs.readFileSync(
    path.join(root, "LPL-Design-System.js"),
    "utf8"
  );
  assert.throws(
    () =>
      contract.validateResourceContent(
        design,
        designSource.replace(/const version = "[^"]+";/, "")
      ),
    /版本/
  );
  assert.throws(
    () =>
      contract.validateResourceContent(
        design,
        designSource.replace("module.exports", "other.exports")
      ),
    /导出/
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
