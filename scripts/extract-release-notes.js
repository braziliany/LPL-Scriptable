const fs = require("node:fs");
const path = require("node:path");

function normalizeVersion(value) {
  return String(value || "")
    .trim()
    .replace(/^v/i, "");
}

function extractReleaseNotes(changelog, requestedVersion) {
  const version = normalizeVersion(requestedVersion);
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`无效版本号：${requestedVersion}`);
  }

  const lines = String(changelog || "").split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith(`## ${version} `));
  if (start === -1) {
    throw new Error(`CHANGELOG 中没有 ${version} 的更新说明`);
  }

  const notes = [];
  for (let index = start + 1; index < lines.length; index++) {
    if (lines[index].startsWith("## ")) break;
    notes.push(lines[index]);
  }
  const result = notes.join("\n").trim();
  if (!result) throw new Error(`${version} 的更新说明为空`);
  return result;
}

if (require.main === module) {
  try {
    const version = process.argv[2];
    const changelog = fs.readFileSync(
      path.join(__dirname, "..", "CHANGELOG.md"),
      "utf8"
    );
    process.stdout.write(`${extractReleaseNotes(changelog, version)}\n`);
  } catch (error) {
    console.error(error.message || error);
    process.exitCode = 1;
  }
}

module.exports = {
  extractReleaseNotes,
  normalizeVersion,
};
