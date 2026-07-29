const assert = require("node:assert/strict");
const {
  assertVersionConsistency,
  extractVersion,
} = require("../scripts/check-version");
const {
  extractReleaseNotes,
  normalizeVersion,
} = require("../scripts/extract-release-notes");

assert.equal(normalizeVersion("v2.2.0"), "2.2.0");
assert.equal(
  extractVersion('const version = "2.2.0";', /version = "([^"]+)"/, "fixture"),
  "2.2.0"
);
assert.equal(
  assertVersionConsistency({
    package: "2.2.0",
    installer: "2.2.0",
    designSystem: "2.2.0",
    widget: "2.2.0",
  }),
  "2.2.0"
);
assert.throws(
  () =>
    assertVersionConsistency({
      package: "2.2.0",
      installer: "2.2.0",
      designSystem: "2.1.0",
      widget: "2.2.0",
    }),
  /项目版本不一致/
);
assert.throws(
  () =>
    assertVersionConsistency(
      {
        package: "2.2.0",
        installer: "2.2.0",
        designSystem: "2.2.0",
        widget: "2.2.0",
      },
      "2.3.0"
    ),
  /标签版本/
);

const changelog = [
  "# 更新日志",
  "",
  "## 2.2.0 · 2026-07-29",
  "",
  "- 第一项",
  "- 第二项",
  "",
  "## 2.1.0 · 2026-07-29",
  "",
  "- 旧版本",
].join("\n");
assert.equal(extractReleaseNotes(changelog, "v2.2.0"), "- 第一项\n- 第二项");
assert.throws(() => extractReleaseNotes(changelog, "v3.0.0"), /没有 3.0.0/);

console.log("release tools: ok");
