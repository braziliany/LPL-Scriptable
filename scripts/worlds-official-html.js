const crypto = require("node:crypto");

const STATES = {
  unstarted: "upcoming",
  inProgress: "live",
  completed: "finished",
};
function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

// Read JSON boundaries only. Never evaluate the surrounding Apollo JavaScript.
function jsonArrayAt(text, start) {
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === "[") depth++;
    else if (char === "]" && --depth === 0) {
      return JSON.parse(text.slice(start, i + 1));
    }
  }
  throw new Error("Truncated events JSON");
}

function extractEvents(html) {
  invariant(
    typeof html === "string" && html.length <= 12_000_000,
    "Invalid HTML response"
  );
  const arrays = [];
  for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (!script[1].includes('Symbol.for("ApolloSSRDataTransport")')) continue;
    // Apollo also has a transport-level "events" array containing JavaScript
    // options (including undefined). Only EsportsData.events is schedule JSON.
    for (const marker of script[1].matchAll(
      /"__typename"\s*:\s*"EsportsData"\s*,\s*"events"\s*:\s*(\[)/g
    )) {
      const start = marker.index + marker[0].lastIndexOf("[");
      arrays.push(jsonArrayAt(script[1], start));
    }
  }
  invariant(arrays.length > 0, "Official events container missing or changed");
  return arrays.flat();
}

function utcToBeijing(value) {
  invariant(
    typeof value === "string" &&
      /^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value),
    "startTime must be UTC ISO"
  );
  const date = new Date(value);
  invariant(
    Number.isFinite(date.getTime()) &&
      date.toISOString().replace(".000Z", "Z") === value.replace(".000Z", "Z"),
    "Invalid UTC calendar date"
  );
  return new Date(date.getTime() + 8 * 3600_000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}

function normalizeEvent(event, spec) {
  invariant(
    event.__typename === "EventMatch" && event.type === "match",
    "Unexpected event type"
  );
  invariant(
    event.league?.slug === spec.slug &&
      event.league?.id === spec.leagueId &&
      event.tournament?.id === spec.officialTournamentId &&
      event.tournament?.name === spec.season,
    "Tournament identity mismatch"
  );
  invariant(
    typeof event.id === "string" &&
      /^\d+$/.test(event.id) &&
      event.match?.id === event.id,
    "Match identity mismatch"
  );
  invariant(
    Object.hasOwn(STATES, event.state) && event.match.state === event.state,
    "Unknown or conflicting upstream state"
  );
  invariant(
    event.match.strategy?.type === "bestOf" &&
      [1, 3, 5].includes(event.match.strategy.count),
    "Unknown series format"
  );
  invariant(
    typeof event.blockName === "string" && event.blockName.trim(),
    "Stage missing"
  );
  invariant(
    Array.isArray(event.matchTeams) && event.matchTeams.length === 2,
    "Two teams required"
  );
  const teams = event.matchTeams;
  invariant(
    typeof event.startTime === "string" &&
      event.startTime.startsWith(`${spec.season}-`),
    "Match year mismatch"
  );
  for (const team of teams) {
    invariant(
      typeof team.code === "string" &&
        team.code.trim() &&
        typeof team.name === "string" &&
        team.name.trim() &&
        typeof team.teamId === "string",
      "Team fields changed"
    );
    invariant(
      team.code === "TBD"
        ? team.teamId === "0" && team.name === "TBD"
        : /^[1-9]\d*$/.test(team.teamId),
      "Unknown team identity"
    );
    invariant(
      team.result === null ||
        (team.result &&
          Number.isInteger(team.result.gameWins) &&
          team.result.gameWins >= 0),
      "Malformed score"
    );
    if (event.state !== "unstarted")
      invariant(
        team.code !== "TBD" && team.result !== null,
        "Played match missing team or score"
      );
    if (event.state === "unstarted")
      invariant(
        team.result === null || team.result.gameWins === 0,
        "Unstarted match has nonzero score"
      );
  }
  invariant(
    teams[0].teamId !== teams[1].teamId || teams.every((t) => t.code === "TBD"),
    "Self match"
  );
  const score = (team) =>
    event.state === "unstarted" ? null : team.result.gameWins;
  const match = {
    participants: {
      version: 1,
      source: {
        provider: "riot-lolesports",
        url: spec.url,
        leagueId: spec.leagueId,
        tournamentId: spec.officialTournamentId,
        matchId: event.id,
      },
      left: {
        kind: teams[0].code === "TBD" ? "placeholder" : "team",
        id: teams[0].teamId,
      },
      right: {
        kind: teams[1].code === "TBD" ? "placeholder" : "team",
        id: teams[1].teamId,
      },
    },
    id: event.id,
    tournamentId: spec.id,
    startTime: utcToBeijing(event.startTime),
    left: teams[0].code,
    right: teams[1].code,
    status: STATES[event.state],
    matchType: `BO${event.match.strategy.count}`,
    stage: event.blockName,
    leftScore: score(teams[0]),
    rightScore: score(teams[1]),
    liveUrl: "https://lolesports.com/en-US/",
    detailUrl: spec.url,
  };
  // Preserve upstream LIVE; the existing production series-aware ViewModel
  // remains the only authority for score-derived FINISHED.
  return match;
}

function adaptHtml({ html, spec, fetchedAt }) {
  invariant(
    Number.isFinite(new Date(fetchedAt).getTime()),
    "Fetch time required"
  );
  const byId = new Map();
  const provenance = {};
  let ignoredHistorical = 0;
  for (const event of extractEvents(html)) {
    invariant(event && typeof event === "object", "Malformed event");
    invariant(
      event.league && event.tournament,
      "Event identity fields missing"
    );
    if (
      event.league.id === spec.leagueId ||
      event.tournament.id === spec.officialTournamentId
    ) {
      invariant(event.league.slug === spec.slug, "League slug mismatch");
    }
    if (event.league.slug !== spec.slug) continue;
    // The official page includes previous seasons. Never relabel those as 2026.
    if (event.tournament.name !== spec.season) {
      invariant(
        /^20\d{2}$/.test(event.tournament.name) &&
          Number(event.tournament.name) < Number(spec.season),
        "Unrecognized season identity"
      );
      ignoredHistorical++;
      continue;
    }
    const match = normalizeEvent(event, spec);
    // Rehydration and transport copies have different object key ordering.
    // Compare the mapped contract and raw score/time evidence, not key order.
    const original = JSON.stringify({
      match,
      scores: event.matchTeams.map((team) => team.result?.gameWins ?? null),
      teamIds: event.matchTeams.map((team) => team.teamId),
      utc: event.startTime,
    });
    if (byId.has(match.id))
      invariant(
        byId.get(match.id).original === original,
        "Conflicting duplicate match ID"
      );
    else {
      byId.set(match.id, { match, original });
      provenance[match.id] = {
        utcStartTime: event.startTime,
        upstreamStatus: event.state,
        officialTournamentId: event.tournament.id,
        upstreamScores: event.matchTeams.map((t) => t.result?.gameWins ?? null),
      };
    }
  }
  const matches = [...byId.values()]
    .map((item) => item.match)
    .sort(
      (a, b) =>
        a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id)
    );
  const matchIds = matches.map((m) => m.id).sort();
  const candidate = {
    contractVersion: 1,
    availability: "INCOMPLETE",
    tournamentId: spec.id,
    source: {
      url: spec.url,
      fetchedAt: new Date(fetchedAt).toISOString(),
      bodySha256: crypto.createHash("sha256").update(html).digest("hex"),
      leagueSlug: spec.slug,
      leagueId: spec.leagueId,
      officialTournamentId: spec.officialTournamentId,
      authorization: "NOT VERIFIED",
      stability: "NOT VERIFIED",
      unattendedProductionEnabled: false,
    },
    completeness: {
      scope: "published-window",
      verified: false,
      evidence: null,
      ignoredHistorical,
      entireTournamentVerified: false,
    },
    matchIds,
    provenance,
    schedule: {
      tournamentId: spec.id,
      updatedAt: new Date(fetchedAt).toISOString(),
      source: spec.url,
      matches,
    },
  };
  return candidate;
}

module.exports = { extractEvents, utcToBeijing, normalizeEvent, adaptHtml };
