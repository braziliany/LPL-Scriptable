const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const tests = [
  "tests/installer.test.js",
  "tests/design-system.test.js",
  "tests/update-schedule.test.js",
  "tests/official-schedule-parser.test.js",
  "tests/schedule-schema.test.js",
  "tests/release-tools.test.js",
];
const syntaxChecks = [
  "Installer.js",
  "LPL-Design-System.js",
  "LPL-Schedule.js",
  "scripts/update-schedule.js",
  "scripts/check-version.js",
  "scripts/extract-release-notes.js",
];

for (const file of tests) {
  execFileSync(process.execPath, [file], {
    cwd: root,
    stdio: "inherit",
  });
}
for (const file of syntaxChecks) {
  execFileSync(process.execPath, ["--check", file], {
    cwd: root,
    stdio: "inherit",
  });
}

console.log("all tests: ok");
