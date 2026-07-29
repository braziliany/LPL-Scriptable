const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

function extractVersion(content, pattern, label) {
  const match = String(content || "").match(pattern);
  if (!match) throw new Error(`无法从 ${label} 读取版本号`);
  return match[1];
}

function readProjectVersions(root = ROOT) {
  const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
  return {
    package: JSON.parse(read("package.json")).version,
    installer: extractVersion(
      read("Installer.js"),
      /const CONFIG = \{\s*version: "(\d+\.\d+\.\d+)"/,
      "Installer.js"
    ),
    designSystem: extractVersion(
      read("LPL-Design-System.js"),
      /const version = "(\d+\.\d+\.\d+)"/,
      "LPL-Design-System.js"
    ),
    widget: extractVersion(
      read("LPL-Schedule.js"),
      /const APP = \{\s*name: "LPL Schedule",\s*version: "(\d+\.\d+\.\d+)"/,
      "LPL-Schedule.js"
    ),
  };
}

function assertVersionConsistency(versions, expectedVersion = null) {
  const unique = [...new Set(Object.values(versions))];
  if (unique.length !== 1) {
    throw new Error(
      `项目版本不一致：${Object.entries(versions)
        .map(([name, version]) => `${name}=${version}`)
        .join(", ")}`
    );
  }
  if (expectedVersion && unique[0] !== expectedVersion) {
    throw new Error(
      `标签版本 ${expectedVersion} 与项目版本 ${unique[0]} 不一致`
    );
  }
  return unique[0];
}

if (require.main === module) {
  try {
    const expectedVersion = process.argv[2] || null;
    const version = assertVersionConsistency(
      readProjectVersions(),
      expectedVersion
    );
    console.log(`version consistency: ok (${version})`);
  } catch (error) {
    console.error(error.message || error);
    process.exitCode = 1;
  }
}

module.exports = {
  assertVersionConsistency,
  extractVersion,
  readProjectVersions,
};
