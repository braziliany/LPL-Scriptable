// Converts observed Cito Worlds responses into a private, unlicensed candidate.
// This module never writes production data or asserts redistribution rights.
const SOURCE_URL =
  "https://api.citoapi.com/api/v1/lol/leagues/lol-worlds/schedule";
const DETAIL_URL = "https://lolesports.com/en-US/leagues/worlds";
const LEAGUE_ID = "lol-worlds";
const TOURNAMENT_ID = "lol-worlds_2026";
const STATUS = {
  unstarted: "upcoming",
  scheduled: "upcoming",
  upcoming: "upcoming",
  inprogress: "live",
  live: "live",
  completed: "finished",
  finished: "finished",
};

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function beijingTime(value) {
  invariant(
    typeof value === "string" &&
      /^2026-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value),
    "Cito startTime invalid"
  );
  const instant = new Date(value);
  invariant(
    Number.isFinite(instant.getTime()) &&
      instant.toISOString() ===
        (value.includes(".") ? value : value.replace("Z", ".000Z")),
    "Cito startTime invalid"
  );
  const local = new Date(instant.getTime() + 8 * 3600_000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
  invariant(
    local.slice(0, 10) >= "2026-10-15" && local.slice(0, 10) <= "2026-11-15",
    "Cito event outside Worlds 2026 window"
  );
  return local;
}

function participant(value, status) {
  invariant(value && typeof value === "object", "Cito team missing");
  const slug = String(value.slug || "");
  const code = String(value.code || "");
  invariant(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug), "Cito team slug invalid");
  invariant(/^[A-Z0-9]+$/.test(code), "Cito team code invalid");
  invariant(
    typeof value.name === "string" && value.name.trim(),
    "Cito team name missing"
  );
  invariant(
    (slug === "tbd") === (code === "TBD"),
    "Cito TBD identity conflict"
  );
  if (slug === "tbd")
    invariant(status === "upcoming", "Cito TBD state invalid");
  return {
    code,
    identity: { kind: slug === "tbd" ? "placeholder" : "team", id: slug },
    logo: safeLogo(value.imageUrl),
    score: value.score,
    outcome: value.outcome,
  };
}

function safeLogo(value) {
  const url = String(value || "").replace(
    /^http:\/\/static\.lolesports\.com\//,
    "https://static.lolesports.com/"
  );
  return /^https:\/\/(?:static\.lolesports\.com\/teams\/|api\.citoapi\.com\/api\/v1\/public\/images\/lol\/stored\/)[^\s?#]+$/.test(
    url
  )
    ? url
    : "";
}

function mapEvent(event, observedAt, previous) {
  invariant(
    event?.leagueId === LEAGUE_ID &&
      event?.leagueName === "Worlds" &&
      event?.tournamentId === TOURNAMENT_ID &&
      event?.type === "match",
    "Cito Worlds identity conflict"
  );
  const id = String(event.matchId || "");
  invariant(/^lol-match-[1-9]\d*$/.test(id), "Cito match ID invalid");
  const startTime = beijingTime(event.startTime);
  const state = STATUS[String(event.state || "").toLowerCase()];
  invariant(state, "Cito match state invalid");
  const bo = event.strategy?.count;
  invariant(
    event.strategy?.type === "bestOf" && [1, 3, 5].includes(bo),
    "Cito BO invalid"
  );
  invariant(
    Array.isArray(event.teams) && event.teams.length === 2,
    "Cito team count invalid"
  );
  const [left, right] = event.teams.map((team) => participant(team, state));
  invariant(
    left.identity.id !== right.identity.id || left.identity.id === "tbd",
    "Cito same team on both sides"
  );
  const leftScore = state === "upcoming" ? null : left.score;
  const rightScore = state === "upcoming" ? null : right.score;
  if (state !== "upcoming") {
    const wins = (bo + 1) / 2;
    invariant(
      Number.isInteger(leftScore) &&
        Number.isInteger(rightScore) &&
        leftScore >= 0 &&
        rightScore >= 0 &&
        leftScore <= wins &&
        rightScore <= wins,
      "Cito match score invalid"
    );
    if (state === "finished") {
      invariant(
        (leftScore === wins &&
          rightScore < wins &&
          left.outcome === "win" &&
          right.outcome === "loss") ||
          (rightScore === wins &&
            leftScore < wins &&
            right.outcome === "win" &&
            left.outcome === "loss"),
        "Cito completed result conflict"
      );
    }
  }
  const scoreChanged =
    !previous ||
    previous.status !== state ||
    previous.leftScore !== leftScore ||
    previous.rightScore !== rightScore;
  return {
    id,
    gameId: LEAGUE_ID,
    tournamentId: "worlds-2026",
    startTime,
    left: left.code,
    right: right.code,
    leftLogo: left.logo,
    rightLogo: right.logo,
    status: state,
    matchType: `BO${bo}`,
    stage: String(event.blockName || "").trim(),
    leftScore,
    rightScore,
    scoreUpdatedAt:
      state === "upcoming"
        ? null
        : scoreChanged
          ? observedAt
          : previous.scoreUpdatedAt || observedAt,
    finishedAt:
      state !== "finished"
        ? null
        : previous?.status === "finished"
          ? previous.finishedAt || observedAt
          : observedAt,
    liveUrl: "",
    detailUrl: DETAIL_URL,
    participants: {
      version: 1,
      source: {
        provider: "cito-api",
        url: SOURCE_URL,
        leagueId: LEAGUE_ID,
        tournamentId: TOURNAMENT_ID,
        matchId: id,
      },
      left: left.identity,
      right: right.identity,
    },
  };
}

function convertCitoWorlds(
  pages,
  { observedAt, previousSchedule = null } = {}
) {
  invariant(
    typeof observedAt === "string" &&
      Number.isFinite(Date.parse(observedAt)) &&
      new Date(observedAt).toISOString() === observedAt,
    "Cito observation time invalid"
  );
  invariant(Array.isArray(pages) && pages.length > 0, "Cito pages missing");
  const events = [];
  let expectedOffset = 0;
  let total = null;
  for (const [index, page] of pages.entries()) {
    const data = page?.data;
    invariant(
      page?.success === true &&
        data?.leagueId === LEAGUE_ID &&
        data?.leagueName === "Worlds",
      "Cito page identity invalid"
    );
    invariant(Array.isArray(data.events), "Cito events missing");
    invariant(
      Number.isInteger(data.offset) &&
        data.offset === expectedOffset &&
        Number.isInteger(data.count) &&
        data.count === data.events.length &&
        Number.isInteger(data.total) &&
        typeof data.hasMore === "boolean",
      "Cito pagination invalid"
    );
    if (total === null) total = data.total;
    invariant(data.total === total, "Cito pagination total changed");
    invariant(
      data.hasMore === index < pages.length - 1,
      "Cito pagination incomplete"
    );
    events.push(...data.events);
    expectedOffset += data.events.length;
  }
  invariant(
    events.length === total && events.length > 0,
    "Cito pagination count invalid"
  );
  const ids = events.map((event) => String(event?.matchId || ""));
  invariant(new Set(ids).size === ids.length, "Cito duplicate match ID");
  const previous = new Map(
    (previousSchedule?.matches || []).map((match) => [match.id, match])
  );
  const matches = events
    .map((event) => mapEvent(event, observedAt, previous.get(event.matchId)))
    .sort(
      (a, b) =>
        a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id)
    );
  invariant(
    matches.every((match) => match.stage),
    "Cito match stage missing"
  );
  const current = new Map(matches.map((match) => [match.id, match]));
  const addedIds = [...current.keys()].filter((id) => !previous.has(id)).sort();
  const removedIds = [...previous.keys()]
    .filter((id) => !current.has(id))
    .sort();
  const changedIds = [...current.keys()]
    .filter(
      (id) =>
        previous.has(id) &&
        JSON.stringify(previous.get(id)) !== JSON.stringify(current.get(id))
    )
    .sort();
  const schedule = {
    tournamentId: "worlds-2026",
    updatedAt: observedAt,
    source: SOURCE_URL,
    sourceUrl: SOURCE_URL,
    classification: "PARTIAL_OBSERVED",
    sourceAuthorization: "NOT_VERIFIED",
    coverageVerified: false,
    coverageStart: matches[0].startTime.slice(0, 10),
    coverageEnd: matches[matches.length - 1].startTime.slice(0, 10),
    matches,
  };
  return {
    schedule,
    audit: {
      observedAt,
      sourceUpdatedAt: null,
      matchCount: matches.length,
      coverageStart: schedule.coverageStart,
      coverageEnd: schedule.coverageEnd,
      addedIds,
      removedIds,
      changedIds,
      publicationBlocked: true,
      publicationBlockers: [
        "SOURCE_AUTHORIZATION_NOT_VERIFIED",
        "COVERAGE_NOT_VERIFIED",
        ...(removedIds.length ? ["PREVIOUS_MATCH_IDS_MISSING"] : []),
      ],
    },
  };
}

module.exports = {
  SOURCE_URL,
  DETAIL_URL,
  LEAGUE_ID,
  TOURNAMENT_ID,
  convertCitoWorlds,
};
