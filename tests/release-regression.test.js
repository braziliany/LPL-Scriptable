const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const active = JSON.parse(
  fs.readFileSync(path.join(root, "data", "active.json"), "utf8")
);
const designSystem = require("../LPL-Design-System");
const source = fs
  .readFileSync(path.join(root, "LPL-Schedule.js"), "utf8")
  .replace(
    "await main();",
    `globalThis.__releaseTestApi = {
      normalizeActivePayload,
      selectScheduleResult,
      tournamentFooterText,
      tournamentTitle,
    };`
  );
const context = {
  console,
  Set,
  importModule: () => designSystem,
};
vm.runInNewContext(source, context, { filename: "LPL-Schedule.js" });

const route = context.__releaseTestApi.normalizeActivePayload(active);
assert.equal(route.tournament.id, active.tournament.id);
assert.equal(route.selectedDate, active.selectedDate);
assert.equal(route.selectionReason, active.selectionReason);
assert.equal(route.matches.length > 0, true);
assert.equal(
  route.matches.every(
    (match) => match.left && match.right && match.leftLogo && match.rightLogo
  ),
  true
);

const snapshots = ["small", "medium", "large"].map((family) => {
  const result = context.__releaseTestApi.selectScheduleResult(route);
  return {
    family,
    tournamentId: result.tournament.id,
    selectedDate: result.dateString,
    matchIds: result.matches.map((match) => match.id),
    title: context.__releaseTestApi.tournamentTitle(result.tournament),
    footer: context.__releaseTestApi.tournamentFooterText(result.tournament),
  };
});

for (const snapshot of snapshots.slice(1)) {
  assert.deepEqual(
    { ...snapshot, family: snapshots[0].family },
    snapshots[0],
    `${snapshot.family} 与 ${snapshots[0].family} 数据不一致`
  );
}
assert.equal(snapshots[0].title, active.tournament.shortName);
assert.equal(
  snapshots[0].footer,
  `${active.tournament.name} · ${active.tournament.stage}`
);

console.log("release regression: ok");
