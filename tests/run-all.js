const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const tests = [
  "tests/installer.test.js",
  "tests/personal-cito-installer.test.js",
  "tests/production-installer-contract.test.js",
  "tests/installer-rc.test.js",
  "tests/dev-installer.test.js",
  "tests/design-system.test.js",
  "tests/update-schedule.test.js",
  "tests/update-schedule-retry.test.js",
  "tests/official-schedule-parser.test.js",
  "tests/series-effective-status.test.js",
  "tests/remote-schedule-fallback.test.js",
  "tests/network-timeout-cache.test.js",
  "tests/worlds-reviewed-dev.test.js",
  "tests/worlds-reviewed-update.test.js",
  "tests/worlds-api-schedule.test.js",
  "tests/worlds-tencent-candidate.test.js",
  "tests/stage-worlds-tencent.test.js",
  "tests/worlds-cito-candidate.test.js",
  "tests/worlds-cito-convert.test.js",
  "tests/worlds-cito-personal.test.js",
  "tests/worlds-cito-personal-client.test.js",
  "tests/stage-worlds-cito.test.js",
  "tests/worlds-production-client.test.js",
  "tests/timer-units.test.js",
  "tests/release-regression.test.js",
  "tests/tournament-router.test.js",
  "tests/tournament-transition.test.js",
  "tests/tournament-active-generator.test.js",
  "tests/tournament-data-schema.test.js",
  "tests/schedule-schema.test.js",
  "tests/release-tools.test.js",
];
const syntaxChecks = [
  "Installer.js",
  "LPL-Design-System.js",
  "LPL-Schedule.js",
  "LPL-Cito-Worlds.js",
  "LPL-Cito-Personal.js",
  "scripts/update-schedule.js",
  "scripts/build-tournament-data.js",
  "scripts/generate-active.js",
  "scripts/build-dev-installer.js",
  "scripts/worlds-official-html.js",
  "scripts/worlds-reviewed-update.js",
  "scripts/worlds-api-schedule.js",
  "scripts/worlds-tencent-candidate.js",
  "scripts/stage-worlds-tencent.js",
  "scripts/worlds-cito-candidate.js",
  "scripts/worlds-cito-convert.js",
  "scripts/stage-worlds-cito.js",
  "Installer-Dev.js",
  "src/tournament-router.js",
  "scripts/check-version.js",
  "scripts/build-personal-cito-installer.js",
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
