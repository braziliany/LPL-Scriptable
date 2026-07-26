const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const scriptPath = path.join(__dirname, "..", "LPL-Schedule.js");
const source = fs
  .readFileSync(scriptPath, "utf8")
  .replace(
    "await main();",
    "globalThis.__testApi = { parseOfficialSchedule };"
  );
const context = {
  console,
  Set,
};

vm.runInNewContext(source, context, { filename: scriptPath });

const pageText = [
  "LNG",
  "2026-07-26 15:00",
  "NIP",
  "TT",
  "2026-07-26 17:00",
  "EDG",
  "AL",
  "2026-07-26 19:00",
  "BLG",
].join("\n");

const matches = JSON.parse(
  JSON.stringify(context.__testApi.parseOfficialSchedule(pageText))
);

assert.deepEqual(
  matches.map(({ time, left, right }) => ({ time, left, right })),
  [
    { time: "15:00", left: "LNG", right: "NIP" },
    { time: "17:00", left: "TT", right: "EDG" },
    { time: "19:00", left: "AL", right: "BLG" },
  ]
);

console.log("official schedule parser: ok");
