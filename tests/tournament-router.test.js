const assert = require("node:assert/strict");
const { selectTournament } = require("../src/tournament-router");

function tournament(id, priority, startDate, endDate, overrides = {}) {
  return {
    id,
    name: id,
    shortName: id.toUpperCase(),
    season: "2026",
    region: "CN",
    stage: "测试",
    startDate,
    endDate,
    priority,
    enabled: true,
    schedulePath: `data/schedules/${id}.json`,
    ...overrides,
  };
}

function match(tournamentId, startTime, left = "AAA", right = "BBB") {
  return {
    tournamentId,
    startTime,
    left,
    right,
    status: "upcoming",
    matchType: "BO3",
    stage: "测试",
    leftScore: null,
    rightScore: null,
    liveUrl: "",
    detailUrl: "",
  };
}

function schedules(...matches) {
  return matches.reduce((result, item) => {
    result[item.tournamentId] ||= {
      tournamentId: item.tournamentId,
      matches: [],
    };
    result[item.tournamentId].matches.push(item);
    return result;
  }, {});
}

function route(now, tournaments, scheduleMap) {
  return selectTournament({ now, tournaments, schedules: scheduleMap });
}

const regular = tournament("lpl-regular", 60, "2026-07-22", "2026-08-23");
const playoffs = tournament("lpl-playoffs", 75, "2026-08-28", "2026-09-13");
const ewc = tournament("ewc", 90, "2026-07-15", "2026-07-19", {
  region: "INTL",
});
const worlds = tournament("worlds", 100, "2026-10-15", "2026-11-14", {
  region: "INTL",
});

let result = route(
  "2026-08-10T02:00:00Z",
  [regular],
  schedules(match(regular.id, "2026-08-10 17:00:00"))
);
assert.equal(result.activeTournament.id, regular.id);
assert.equal(result.selectionReason, "SMART_TODAY_MATCHES");

result = route(
  "2026-08-29T02:00:00Z",
  [regular, playoffs],
  schedules(
    match(regular.id, "2026-08-23 17:00:00"),
    match(playoffs.id, "2026-08-29 17:00:00")
  )
);
assert.equal(result.activeTournament.id, playoffs.id);

result = route(
  "2026-08-29T02:00:00Z",
  [{ ...playoffs, enabled: false }],
  schedules(match(playoffs.id, "2026-08-29 17:00:00"))
);
assert.equal(result.activeTournament, null);
assert.equal(result.selectionReason, "SMART_NO_AVAILABLE_MATCHES");

const sameDay = "2026-07-18 17:00:00";
result = route(
  "2026-07-18T02:00:00Z",
  [tournament("lpl-overlap", 60, "2026-07-01", "2026-07-31"), ewc],
  schedules(match("lpl-overlap", sameDay), match(ewc.id, sameDay))
);
assert.equal(result.activeTournament.id, ewc.id);
assert.equal(result.selectionReason, "SMART_TODAY_PRIORITY");

result = route(
  "2026-10-20T02:00:00Z",
  [worlds],
  schedules(match(worlds.id, "2026-10-20 08:00:00"))
);
assert.equal(result.activeTournament.id, worlds.id);

const lplDuringEwc = tournament(
  "lpl-during-ewc",
  60,
  "2026-07-01",
  "2026-07-31"
);
result = route(
  "2026-07-17T02:00:00Z",
  [lplDuringEwc, ewc],
  schedules(
    match(lplDuringEwc.id, "2026-07-17 17:00:00"),
    match(ewc.id, "2026-07-18 17:00:00")
  )
);
assert.equal(result.activeTournament.id, lplDuringEwc.id);

result = route(
  "2026-08-24T02:00:00Z",
  [playoffs],
  schedules(match(playoffs.id, "2026-08-28 14:00:00"))
);
assert.equal(result.selectedDate, "2026-08-28");
assert.equal(result.selectionReason, "SMART_NEAREST_FUTURE");

const low = tournament("future-low", 20, "2026-08-01", "2026-09-30");
const high = tournament("future-high", 80, "2026-08-01", "2026-09-30");
result = route(
  "2026-08-24T02:00:00Z",
  [low, high],
  schedules(
    match(low.id, "2026-08-30 17:00:00"),
    match(high.id, "2026-08-30 19:00:00")
  )
);
assert.equal(result.activeTournament.id, high.id);
assert.equal(result.selectionReason, "SMART_NEAREST_FUTURE_PRIORITY");

result = route(
  "2026-08-24T02:00:00Z",
  [ewc, playoffs],
  schedules(
    match(ewc.id, "2026-08-25 17:00:00"),
    match(playoffs.id, "2026-08-28 14:00:00")
  )
);
assert.equal(result.activeTournament.id, playoffs.id);

console.log("tournament router: ok");
