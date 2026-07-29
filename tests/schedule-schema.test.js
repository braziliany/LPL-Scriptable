const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Ajv2020 = require("ajv/dist/2020");

const root = path.join(__dirname, "..");
const schema = JSON.parse(
  fs.readFileSync(path.join(root, "data", "schedule.schema.json"), "utf8")
);
const schedule = JSON.parse(
  fs.readFileSync(path.join(root, "data", "schedule.json"), "utf8")
);

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(schema);
const valid = validate(schedule);

assert.equal(
  valid,
  true,
  `schedule.json schema validation failed:\n${ajv.errorsText(
    validate.errors,
    { separator: "\n" }
  )}`
);

const ids = schedule.matches.map((match) => match.id);
assert.equal(new Set(ids).size, ids.length, "比赛 ID 必须唯一");
for (let index = 1; index < schedule.matches.length; index++) {
  assert.ok(
    schedule.matches[index - 1].startTime <=
      schedule.matches[index].startTime,
    "比赛必须按开赛时间升序排列"
  );
}

console.log("schedule schema: ok");
