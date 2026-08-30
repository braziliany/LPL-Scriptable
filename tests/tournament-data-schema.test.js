const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Ajv2020 = require("ajv/dist/2020");

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
assert.equal(
  active.matches.every((match) => match.tournamentId),
  true
);

console.log("tournament data schema: ok");
