const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const designSystem = require("../LPL-Design-System");

const source = fs
  .readFileSync(path.join(__dirname, "..", "LPL-Schedule.js"), "utf8")
  .replace(
    /await main\(\);\s*$/,
    "globalThis.testApi = { deriveEffectiveMatchStatus, normalizeMatch, matchSubtitle, findNextMatchDay };"
  );
const context = { console, Set, importModule: () => designSystem };
vm.runInNewContext(source, context);
const {
  deriveEffectiveMatchStatus: derive,
  normalizeMatch,
  matchSubtitle,
  findNextMatchDay,
} = context.testApi;
const now = new Date("2026-09-05T10:00:00Z");
const base = {
  startTime: "2026-09-05 14:00:00",
  left: "BLG",
  right: "TES",
  status: "live",
  matchType: "BO5",
  stage: "季后赛",
  leftScore: 0,
  rightScore: 0,
};

for (const [matchType, leftScore, rightScore, expected] of [
  ["BO1", 0, 0, "live"],
  ["BO1", 1, 0, "finished"],
  ["BO1", 0, 1, "finished"],
  ["BO3", 0, 0, "live"],
  ["BO3", 1, 0, "live"],
  ["BO3", 1, 1, "live"],
  ["BO3", 2, 0, "finished"],
  ["BO3", 0, 2, "finished"],
  ["BO3", 2, 1, "finished"],
  ["BO3", 1, 2, "finished"],
  ["BO5", 0, 0, "live"],
  ["BO5", 1, 0, "live"],
  ["BO5", 2, 0, "live"],
  ["BO5", 2, 2, "live"],
  ["BO5", 3, 0, "finished"],
  ["BO5", 0, 3, "finished"],
  ["BO5", 3, 1, "finished"],
  ["BO5", 1, 3, "finished"],
  ["BO5", 3, 2, "finished"],
  ["BO5", 2, 3, "finished"],
]) {
  const match = { ...base, matchType, leftScore, rightScore };
  assert.equal(derive(match, now).status, expected);
  if (expected === "finished") {
    assert.match(matchSubtitle(normalizeMatch(match), now), /已结束/);
  }
}

const abnormal = derive({ ...base, leftScore: 1, rightScore: 4 }, now);
assert.equal(abnormal.status, "finished");
assert.equal(abnormal.diagnostics.includes("SCORE_EXCEEDS_SERIES_LIMIT"), true);
const reverseAbnormal = derive({ ...base, leftScore: 4, rightScore: 1 }, now);
assert.equal(reverseAbnormal.status, "finished");
assert.equal(
  reverseAbnormal.diagnostics.includes("SCORE_EXCEEDS_SERIES_LIMIT"),
  true
);
assert.equal(
  derive({ ...base, leftScore: null, rightScore: null }, now).status,
  "live"
);
for (const score of [null, undefined, "x", NaN, -1, 1.5]) {
  const match = { ...base, leftScore: score, rightScore: 3 };
  assert.equal(derive(match, now).status, "live");
}
assert.equal(
  derive({ ...base, leftScore: "3", rightScore: "2" }, now).status,
  "finished"
);
assert.equal(
  derive({ ...base, leftScore: 3, rightScore: 3 }, now).status,
  "live"
);
assert.equal(
  derive({ ...base, matchType: "BO4", leftScore: 3 }, now).status,
  "live"
);
assert.equal(
  derive({ ...base, status: "postponed", leftScore: 3 }, now).status,
  "postponed"
);
assert.equal(
  derive({ ...base, status: "cancelled", leftScore: 3 }, now).status,
  "cancelled"
);
assert.equal(
  derive({ ...base, leftScore: 2, rightScore: 2 }, now).status,
  "live"
);
assert.equal(
  derive(
    {
      ...base,
      status: "upcoming",
      leftScore: 0,
      rightScore: 0,
      timestamp: now.getTime() - 24 * 60 * 60 * 1000,
    },
    now
  ).status,
  "live"
);
const day = findNextMatchDay(
  [
    normalizeMatch({ ...base, leftScore: 3, rightScore: 2 }),
    normalizeMatch({
      ...base,
      startTime: "2026-09-06 17:00:00",
      status: "upcoming",
      leftScore: null,
      rightScore: null,
    }),
  ],
  now
);
assert.equal(day.dateString, "2026-09-06");
console.log("series effective status: ok");
