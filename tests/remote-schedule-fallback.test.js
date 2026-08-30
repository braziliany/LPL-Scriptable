const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const scriptPath = path.join(__dirname, "..", "LPL-Schedule.js");
const designSystem = require("../LPL-Design-System");
const source = fs
  .readFileSync(scriptPath, "utf8")
  .replace("await main();", "globalThis.__testApi = { loadSchedule };");

const writes = new Map();
const fileManager = {
  documentsDirectory: () => "/documents",
  joinPath: (directory, name) => `${directory}/${name}`,
  fileExists: () => false,
  readString: (file) => writes.get(file),
  writeString: (file, content) => writes.set(file, content),
};
const staleRemotePayload = {
  season: "2026 LPL 第二赛段",
  updatedAt: "2026-08-27T10:00:00+08:00",
  matches: [
    {
      id: "stale",
      startTime: "2026-08-28 14:00:00",
      left: "EDG",
      right: "NIP",
      status: "upcoming",
      matchType: "BO5",
    },
  ],
};
const officialPageText = [
  "2026 LPL 第三赛段官方赛程",
  "英雄联盟职业联赛骑士之路",
  "EDG",
  "2026-08-28 14:00",
  "NIP",
  "比赛时间以官方公布为准",
].join("\n");

const context = {
  console,
  Set,
  importModule: () => designSystem,
  FileManager: { local: () => fileManager },
  Request: class {
    constructor(url) {
      this.url = url;
    }

    async loadJSON() {
      return staleRemotePayload;
    }
  },
  WebView: class {
    async loadURL() {}

    async evaluateJavaScript() {
      return officialPageText;
    }
  },
  Timer: {
    schedule(seconds, _repeats, callback) {
      const handle = setTimeout(callback, seconds);
      return { invalidate: () => clearTimeout(handle) };
    },
  },
};

vm.runInNewContext(source, context, { filename: scriptPath });

async function main() {
  const result = await context.__testApi.loadSchedule();
  assert.equal(result.source, "官方页面");
  assert.equal(result.matches.length, 1);

  const diagnostics = JSON.parse(
    writes.get("/documents/lpl-schedule-data-diagnostics.json")
  );
  assert.equal(diagnostics.selectedSource, "官方页面");
  assert.equal(diagnostics.attempts[0].source, "GitHub Active");
  assert.equal(diagnostics.attempts[0].status, "failure");
  assert.match(diagnostics.attempts[0].message, /赛事元数据无效/);
  assert.equal(diagnostics.attempts[1].source, "GitHub Legacy");
  assert.equal(diagnostics.attempts[1].status, "failure");
  assert.match(diagnostics.attempts[1].message, /已陈旧：赛季不匹配/);
  assert.equal(diagnostics.attempts[2].source, "官方页面");
  assert.equal(diagnostics.attempts[2].status, "success");

  console.log("remote schedule fallback: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
