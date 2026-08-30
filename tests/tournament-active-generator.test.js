const assert = require("node:assert/strict");
const { buildActive } = require("../scripts/generate-active");
const {
  PLAYOFFS_ID,
  REGIONAL_FINALS_ID,
  REGULAR_ID,
  splitLegacySchedule,
} = require("../scripts/build-tournament-data");

const tournament = {
  id: "worlds-2026",
  name: "2026 英雄联盟全球总决赛",
  shortName: "WORLDS 2026",
  season: "2026",
  region: "INTL",
  stage: "全球总决赛",
  startDate: "2026-10-15",
  endDate: "2026-11-14",
  priority: 100,
  enabled: true,
  schedulePath: "data/schedules/worlds-2026.json",
};
const schedule = {
  tournamentId: tournament.id,
  updatedAt: "2026-10-19T16:00:00+08:00",
  matches: [
    {
      tournamentId: tournament.id,
      startTime: "2026-10-20 17:00:00",
      left: "AAA",
      right: "BBB",
      status: "upcoming",
      matchType: "BO3",
      stage: "瑞士轮",
      leftScore: null,
      rightScore: null,
      liveUrl: "",
      detailUrl: "",
    },
  ],
};

const active = buildActive(new Date("2026-10-20T02:00:00.000Z"), [tournament], {
  [tournament.id]: schedule,
});
assert.equal(active.tournament.id, tournament.id);
assert.equal(active.selectedDate, "2026-10-20");
assert.equal(active.generatedAt, "2026-10-20T02:00:00.000Z");
assert.equal(active.sourceUpdatedAt, "2026-10-19T08:00:00.000Z");

const split = splitLegacySchedule({
  updatedAt: "2026-08-31T03:40:07+08:00",
  matches: [
    { ...schedule.matches[0], stage: "第三赛段组内赛" },
    { ...schedule.matches[0], id: "playoffs", stage: "2026赛季季后赛" },
    { ...schedule.matches[0], id: "regional", stage: "资格赛" },
  ],
});
assert.equal(split[REGULAR_ID].matches[0].tournamentId, REGULAR_ID);
assert.equal(split[PLAYOFFS_ID].matches[0].tournamentId, PLAYOFFS_ID);
assert.equal(
  split[REGIONAL_FINALS_ID].matches[0].tournamentId,
  REGIONAL_FINALS_ID
);

console.log("tournament active generator: ok");
