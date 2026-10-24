const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Ajv2020 = require("ajv/dist/2020");
const { buildActive } = require("../scripts/generate-active");

const root = path.join(__dirname, "..");
const read = (file) =>
  JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const matchSchema = read("data/match.schema.json");
const tournamentsSchema = read("data/tournaments.schema.json");
const scheduleSchema = read("data/tournament-schedule.schema.json");
const activeSchema = read("data/active.schema.json");
const tournaments = read("data/tournaments.json");
const active = read("data/active.json");

const ajv = new Ajv2020({ allErrors: true, strict: true });
ajv.addSchema(matchSchema);
ajv.addSchema(tournamentsSchema);

function assertValid(schema, value, label) {
  const validate = ajv.compile(schema);
  assert.equal(
    validate(value),
    true,
    `${label} 校验失败：\n${ajv.errorsText(validate.errors, { separator: "\n" })}`
  );
}

assertValid(tournamentsSchema, tournaments, "tournaments.json");
for (const tournament of tournaments) {
  const schedule = read(tournament.schedulePath);
  assert.equal(schedule.tournamentId, tournament.id);
  assertValid(scheduleSchema, schedule, tournament.schedulePath);
}
assertValid(activeSchema, active, "active.json");
const validateActive = ajv.compile(activeSchema);
assert.equal(
  validateActive({
    ...active,
    businessState: "MATCHES",
    matches: [],
    selectedDate: null,
  }),
  false
);
assert.equal(
  validateActive({
    ...active,
    businessState: "TOURNAMENT_FINISHED",
    selectedDate: "2026-09-05",
  }),
  false
);
assert.equal(
  active.matches.every((match) => match.tournamentId),
  true
);

const worlds = tournaments.find(
  (tournament) => tournament.id === "worlds-2026"
);
const officialUrl = "https://lolesports.com/en-US/leagues/worlds";
const worldMatch = {
  id: "12345678901",
  tournamentId: "worlds-2026",
  startTime: "2026-10-23 02:00:00",
  left: "TBD",
  right: "TBD",
  status: "upcoming",
  matchType: "BO5",
  stage: "Knockout",
  leftScore: null,
  rightScore: null,
  liveUrl: "",
  detailUrl: officialUrl,
  participants: {
    version: 1,
    source: {
      provider: "riot-lolesports",
      url: officialUrl,
      leagueId: "98767975604431411",
      tournamentId: "115660540725177488",
      matchId: "12345678901",
    },
    left: { kind: "placeholder", id: "0" },
    right: { kind: "placeholder", id: "0" },
  },
};
const worldSchedule = {
  tournamentId: "worlds-2026",
  updatedAt: "2026-10-22T08:00:00Z",
  source: officialUrl,
  sourceUrl: officialUrl,
  classification: "PARTIAL_OBSERVED",
  sourceAuthorization: "VERIFIED",
  coverageVerified: true,
  coverageStart: "2026-10-23",
  coverageEnd: "2026-10-23",
  matches: [worldMatch],
};
assertValid(scheduleSchema, worldSchedule, "synthetic Worlds schedule");
const tencentUrl = "https://lpl.qq.com/web202301/schedule.html";
const tencentMatch = {
  ...worldMatch,
  id: "13660",
  gameId: "246",
  detailUrl: tencentUrl,
  participants: {
    version: 1,
    source: {
      provider: "tencent-lpl",
      url: tencentUrl,
      eventId: "246",
      matchId: "13660",
    },
    left: { kind: "placeholder", id: "297" },
    right: { kind: "placeholder", id: "297" },
  },
};
assertValid(matchSchema, tencentMatch, "synthetic Tencent Worlds match");
const validateMatch = ajv.compile(matchSchema);
assert.equal(
  validateMatch({
    ...tencentMatch,
    participants: {
      ...tencentMatch.participants,
      source: { ...tencentMatch.participants.source, eventId: "245" },
    },
  }),
  false
);
assert.equal(
  validateMatch({
    ...tencentMatch,
    participants: {
      ...tencentMatch.participants,
      left: { kind: "team", id: "297" },
    },
  }),
  false
);
assert.equal(
  validateMatch({
    ...tencentMatch,
    participants: {
      ...tencentMatch.participants,
      left: { kind: "placeholder", id: "0" },
    },
  }),
  false
);
const tencentSchedule = {
  ...worldSchedule,
  sourceUrl: tencentUrl,
  matches: [tencentMatch],
};
assertValid(
  scheduleSchema,
  tencentSchedule,
  "synthetic Tencent Worlds schedule"
);
const worldActive = buildActive(new Date("2026-10-22T08:00:00Z"), [worlds], {
  "worlds-2026": worldSchedule,
});
assertValid(activeSchema, worldActive, "synthetic Worlds active");
const tencentActive = buildActive(new Date("2026-10-22T08:00:00Z"), [worlds], {
  "worlds-2026": tencentSchedule,
});
assertValid(activeSchema, tencentActive, "synthetic Tencent Worlds active");
assert.equal(
  validateActive({ ...worldActive, sourceAuthorization: "NOT_VERIFIED" }),
  false
);

console.log("tournament data schema: ok");
