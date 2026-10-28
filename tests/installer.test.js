const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const installerPath = path.join(__dirname, "..", "Installer.js");
const source = fs.readFileSync(installerPath, "utf8").replace(
  "await main();",
  `globalThis.__installerTestApi = {
      CONFIG,
      compareVersions,
      extractReleaseNotes,
      extractVersion,
      mainScriptNames,
      installDownloads,
    };`
);
const context = {};
vm.runInNewContext(source, context, { filename: installerPath });

const resources = JSON.parse(
  JSON.stringify(context.__installerTestApi.CONFIG.resources)
);
const files = new Map([
  ["/icloud/LPL Schedule.js", "old manually named script"],
  ["/icloud/LPL Schedule 2026.js", "old installed script"],
]);
const fileManager = {
  documentsDirectory: () => "/icloud",
  joinPath: (directory, name) => `${directory}/${name}`,
  fileExists: (target) => files.has(target),
  isFileDownloaded: () => true,
  readString: (target) => files.get(target),
  writeString: (target, content) => files.set(target, content),
};
context.FileManager = { iCloud: () => fileManager };
assert.deepEqual(
  Array.from(
    context.__installerTestApi.mainScriptNames(fileManager, "/icloud")
  ),
  ["英雄联盟比赛赛程表", "LPL Schedule 2026", "LPL Schedule"]
);
async function verifyAliasUpdate() {
  const installed = await context.__installerTestApi.installDownloads([
    { scriptName: "英雄联盟比赛赛程表", content: "new production script" },
  ]);
  assert.deepEqual(Array.from(installed), [
    "英雄联盟比赛赛程表",
    "LPL Schedule 2026",
    "LPL Schedule",
  ]);
  assert.equal(files.get("/icloud/LPL Schedule.js"), "new production script");
  assert.equal(
    files.get("/icloud/英雄联盟比赛赛程表.js"),
    "new production script"
  );
  assert.equal(
    files.get("/icloud/LPL Schedule 2026.js"),
    "new production script"
  );
}
assert.equal(context.__installerTestApi.CONFIG.season, "LoL Esports Schedule");
assert.deepEqual(
  resources.map((resource) => resource.scriptName),
  ["英雄联盟比赛赛程表"]
);
assert.match(resources[0].sourceUrl, /LoL-Esports-Schedule\.js$/);
assert.equal(
  context.__installerTestApi.extractVersion(
    'const APP = { version: "2.1.0" };'
  ),
  "2.1.0"
);
assert.equal(context.__installerTestApi.compareVersions("2.0.1", "2.1.0"), -1);
assert.equal(context.__installerTestApi.compareVersions("2.1.0", "2.1.0"), 0);
assert.equal(context.__installerTestApi.compareVersions("3.0.0", "2.1.0"), 1);
assert.equal(
  context.__installerTestApi.extractReleaseNotes(
    "# 更新日志\n\n## 2.1.0 · 2026-07-29\n\n- 版本检测\n- 更新说明\n\n## 2.0.1 · 2026-07-29",
    "2.1.0"
  ),
  "- 版本检测\n- 更新说明"
);

verifyAliasUpdate().then(() => console.log("installer: ok"));
