const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const designSystem = require("../LPL-Design-System");

const source = fs
  .readFileSync(path.join(__dirname, "..", "LPL-Schedule.js"), "utf8")
  .replace(
    /await main\(\);\s*$/,
    "globalThis.testApi = { normalizeActivePayload, selectScheduleResult, transitionText, renderTransition, renderError };"
  );
const context = { console, Set, importModule: () => designSystem };
vm.runInNewContext(source, context);
const {
  normalizeActivePayload,
  selectScheduleResult,
  transitionText,
  renderTransition,
  renderError,
} = context.testApi;
const now = new Date("2026-09-22T02:00:00Z");
const tournament = {
  id: "lpl-playoffs",
  name: "2026 LPL 第三赛段",
  shortName: "LPL PLAYOFFS",
  season: "2026",
  region: "CN",
  stage: "季后赛",
  startDate: "2026-08-28",
  endDate: "2026-09-13",
  priority: 75,
  enabled: true,
  schedulePath: "data/schedules/lpl-playoffs.json",
};
const nextTournament = {
  ...tournament,
  id: "next-international",
  name: "下一国际赛事",
  shortName: "NEXT 2026",
  startDate: "2026-10-15",
  endDate: "2026-11-14",
  priority: 100,
};
const active = {
  generatedAt: now.toISOString(),
  sourceUpdatedAt: "2026-09-13T11:00:00Z",
  tournament,
  nextTournament,
  businessState: "TOURNAMENT_FINISHED",
  selectedDate: null,
  selectionReason: "SMART_TOURNAMENT_FINISHED",
  matches: [],
};
const normalized = normalizeActivePayload(active, now);
const selected = selectScheduleResult(normalized, now);
assert.equal(selected.businessState, "TOURNAMENT_FINISHED");
assert.equal(selected.matches.length, 0);
assert.equal(transitionText(selected).heading, "LPL PLAYOFFS 已结束");
assert.equal(transitionText(selected).detail, "下一赛事 · 下一国际赛事");

for (const bad of [
  { generatedAt: "2026-09-19T02:00:00Z" },
  { tournament: { ...tournament, season: "2025" } },
  { businessState: "MATCHES" },
  { selectedDate: "2026-09-05" },
]) {
  assert.throws(() => normalizeActivePayload({ ...active, ...bad }, now));
}
const noUpcoming = {
  ...active,
  tournament: { ...tournament, endDate: "2026-09-30" },
  businessState: "NO_UPCOMING",
};
assert.equal(
  normalizeActivePayload(noUpcoming, now).businessState,
  "NO_UPCOMING"
);
assert.equal(
  transitionText(
    selectScheduleResult(normalizeActivePayload(noUpcoming, now), now)
  ).heading,
  "暂无近期比赛"
);

class MockWidget {
  constructor() {
    this.texts = [];
  }
  setPadding() {}
  addSpacer() {}
  addText(value) {
    const item = { value };
    this.texts.push(item);
    return item;
  }
  addStack() {
    return {
      addStack: () => this.addStack(),
      addText: (value) => this.addText(value),
      addSpacer() {},
      layoutHorizontally() {},
      centerAlignContent() {},
    };
  }
}
context.ListWidget = MockWidget;
context.config = { widgetFamily: "medium" };
context.Font = {
  mediumSystemFont: () => ({}),
  boldSystemFont: () => ({}),
};
context.Color = class {};
context.Size = class {};
context.URLScheme = { forRunningScript: () => "scriptable:///run" };
designSystem.applyCardBackground = () => {};
for (const family of ["small", "medium", "large"]) {
  context.config.widgetFamily = family;
  const widget = renderTransition(selected, "GitHub Active");
  const text = widget.texts.map((item) => item.value).join(" | ");
  assert.match(text, /LPL PLAYOFFS/);
  assert.match(text, /下一国际赛事/);
  assert.doesNotMatch(text, /赛程获取失败/);
}
assert.equal(
  renderError(new Error("all sources failed")).texts.some(
    (item) => item.value === "赛程获取失败"
  ),
  true
);
console.log("tournament transition: ok");
