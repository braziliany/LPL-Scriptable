// Stages Cito Worlds candidates only in a new private directory outside Git.
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const Ajv2020 = require("ajv/dist/2020");
const { buildActive, loadTournamentData } = require("./generate-active");
const { convertCitoWorlds } = require("./worlds-cito-convert");

const ROOT = path.join(__dirname, "..");

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function privatePath(value, mustExist, root = ROOT) {
  invariant(
    typeof value === "string" && path.isAbsolute(value),
    "Use an absolute private path"
  );
  const resolved = path.resolve(value);
  const relative = path.relative(root, resolved);
  invariant(
    relative === ".." ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative),
    "Private files must be outside repository"
  );
  invariant(
    fs.existsSync(resolved) === mustExist,
    mustExist ? "Input missing" : "Output already exists"
  );
  return resolved;
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readSchema(root, name) {
  return JSON.parse(fs.readFileSync(path.join(root, "data", name), "utf8"));
}

function validateCandidate(schedule, active, root = ROOT) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  ajv.addSchema(readSchema(root, "match.schema.json"));
  ajv.addSchema(readSchema(root, "tournaments.schema.json"));
  for (const [name, value] of [
    ["tournament-schedule.schema.json", schedule],
    ["active.schema.json", active],
  ]) {
    const schema = readSchema(root, name);
    schema.$id += "?private-candidate";
    schema.properties.sourceAuthorization = { const: "NOT_VERIFIED" };
    schema.properties.coverageVerified = { const: false };
    const validate = ajv.compile(schema);
    invariant(validate(value), `${name}: ${ajv.errorsText(validate.errors)}`);
  }
  invariant(
    active.tournament?.id === "worlds-2026" &&
      active.businessState === "MATCHES" &&
      active.matches.length > 0 &&
      active.matches.every((match) => match.tournamentId === "worlds-2026"),
    "Active did not select Worlds"
  );
}

function stageWorldsCito({
  probeDir,
  outDir,
  previousPath = null,
  root = ROOT,
  now = new Date(),
}) {
  const input = privatePath(probeDir, true, root);
  const output = privatePath(outDir, false, root);
  const observed = JSON.parse(
    fs.readFileSync(path.join(input, "audit.json"), "utf8")
  );
  const pages = JSON.parse(
    fs.readFileSync(path.join(input, "cito-schedule.private.json"), "utf8")
  );
  invariant(
    observed.league?.id === "lol-worlds",
    "Probe league identity invalid"
  );
  const observedTime = Date.parse(observed.observedAt);
  invariant(
    Number.isFinite(observedTime) &&
      now.getTime() - observedTime >= -5 * 60_000 &&
      now.getTime() - observedTime <= 48 * 3600_000,
    "Probe observation expired or in future"
  );
  const previousSchedule = previousPath
    ? JSON.parse(fs.readFileSync(privatePath(previousPath, true, root), "utf8"))
    : null;
  const converted = convertCitoWorlds(pages, {
    observedAt: observed.observedAt,
    previousSchedule,
  });
  invariant(
    observed.rows === converted.schedule.matches.length &&
      observed.uniqueIds === converted.schedule.matches.length &&
      observed.publicPublicationPermitted === false,
    "Probe audit and schedule disagree"
  );
  const { tournaments, schedules } = loadTournamentData(root);
  const active = buildActive(now, tournaments, {
    ...schedules,
    "worlds-2026": converted.schedule,
  });
  validateCandidate(converted.schedule, active, root);
  const scheduleText = json(converted.schedule);
  const activeText = json(active);
  const audit = {
    ...converted.audit,
    probeRequests: observed.requests,
    probeRows: observed.rows,
    leagueMetadataUpdatedAt: observed.leagueMetadataUpdatedAt ?? null,
    selectedDate: active.selectedDate,
    selectedMatches: active.matches.map((match) => match.id),
    candidateSha256: hash(scheduleText),
    activeSha256: hash(activeText),
    schemaValidation: "PASS_PRIVATE_CANDIDATE",
    publicationBlocked: true,
  };
  fs.mkdirSync(output);
  fs.writeFileSync(
    path.join(output, "worlds-2026.candidate.json"),
    scheduleText,
    { flag: "wx" }
  );
  fs.writeFileSync(path.join(output, "active.candidate.json"), activeText, {
    flag: "wx",
  });
  fs.writeFileSync(path.join(output, "audit.json"), json(audit), {
    flag: "wx",
  });
  return { outDir: output, audit };
}

function option(args, name) {
  const index = args.indexOf(`--${name}`);
  return index < 0 ? null : args[index + 1];
}

if (require.main === module) {
  try {
    const result = stageWorldsCito({
      probeDir: option(process.argv, "probe"),
      outDir: option(process.argv, "out"),
      previousPath: option(process.argv, "previous"),
    });
    console.log(
      JSON.stringify({
        outDir: result.outDir,
        observedAt: result.audit.observedAt,
        matchCount: result.audit.matchCount,
        selectedDate: result.audit.selectedDate,
        selectedMatches: result.audit.selectedMatches.length,
        publicationBlocked: true,
      })
    );
  } catch (error) {
    console.error(`Cito stage failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { stageWorldsCito, validateCandidate };
