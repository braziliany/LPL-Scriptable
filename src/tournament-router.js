const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

function toDate(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("当前北京时间无效");
  return date;
}

function beijingDateString(value) {
  const date = toDate(value);
  return new Date(date.getTime() + BEIJING_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

function matchDateString(match) {
  const value = String(match?.startTime || "");
  const result = value.match(/^(20\d{2}-\d{2}-\d{2})\s+\d{2}:\d{2}:\d{2}$/);
  return result ? result[1] : null;
}

function scheduleFor(schedules, tournamentId) {
  if (Array.isArray(schedules)) {
    return schedules.find(
      (schedule) => schedule?.tournamentId === tournamentId
    );
  }
  return schedules?.[tournamentId] || null;
}

function eligibleMatches(tournament, schedules, today) {
  const schedule = scheduleFor(schedules, tournament.id);
  const matches = Array.isArray(schedule?.matches) ? schedule.matches : [];
  return matches.filter((match) => {
    const date = matchDateString(match);
    return (
      match?.tournamentId === tournament.id &&
      date &&
      date >= today &&
      date >= tournament.startDate &&
      date <= tournament.endDate
    );
  });
}

function comparePriority(left, right) {
  return (
    Number(right.tournament.priority) - Number(left.tournament.priority) ||
    left.tournament.id.localeCompare(right.tournament.id)
  );
}

function enabledTournaments(tournaments) {
  return tournaments.filter((tournament) => tournament?.enabled === true);
}

function nextTournamentAfter(tournaments, today, excludeId = null) {
  return (
    enabledTournaments(tournaments)
      .filter(
        (tournament) =>
          tournament.id !== excludeId && tournament.startDate > today
      )
      .sort(
        (left, right) =>
          left.startDate.localeCompare(right.startDate) ||
          Number(right.priority) - Number(left.priority) ||
          left.id.localeCompare(right.id)
      )[0] || null
  );
}

function selection(tournament, date, matches, reason, tournaments, today) {
  return {
    activeTournament: tournament,
    nextTournament: nextTournamentAfter(tournaments, today, tournament.id),
    businessState: "MATCHES",
    selectedDate: date,
    matches: [...matches].sort((left, right) =>
      left.startTime.localeCompare(right.startTime)
    ),
    selectionReason: reason,
  };
}

function selectTournament({
  now = new Date(),
  tournaments = [],
  schedules = {},
}) {
  const today = beijingDateString(now);
  const enabled = enabledTournaments(tournaments).filter(
    (tournament) => tournament.endDate >= today
  );

  const candidates = enabled.map((tournament) => ({
    tournament,
    matches: eligibleMatches(tournament, schedules, today),
  }));
  const todayCandidates = candidates
    .map((candidate) => ({
      ...candidate,
      matches: candidate.matches.filter(
        (match) => matchDateString(match) === today
      ),
    }))
    .filter((candidate) => candidate.matches.length)
    .sort(comparePriority);

  if (todayCandidates.length) {
    const winner = todayCandidates[0];
    return selection(
      winner.tournament,
      today,
      winner.matches,
      todayCandidates.length > 1
        ? "SMART_TODAY_PRIORITY"
        : "SMART_TODAY_MATCHES",
      tournaments,
      today
    );
  }

  const futureCandidates = candidates
    .map((candidate) => {
      const dates = candidate.matches
        .map(matchDateString)
        .filter((date) => date && date > today)
        .sort();
      const nextDate = dates[0] || null;
      return {
        ...candidate,
        nextDate,
        matches: nextDate
          ? candidate.matches.filter(
              (match) => matchDateString(match) === nextDate
            )
          : [],
      };
    })
    .filter((candidate) => candidate.nextDate)
    .sort(
      (left, right) =>
        left.nextDate.localeCompare(right.nextDate) ||
        comparePriority(left, right)
    );

  if (futureCandidates.length) {
    const winner = futureCandidates[0];
    const tied = futureCandidates.filter(
      (candidate) => candidate.nextDate === winner.nextDate
    );
    return selection(
      winner.tournament,
      winner.nextDate,
      winner.matches,
      tied.length > 1
        ? "SMART_NEAREST_FUTURE_PRIORITY"
        : "SMART_NEAREST_FUTURE",
      tournaments,
      today
    );
  }

  const currentTournament = enabled
    .filter(
      (tournament) =>
        tournament.startDate <= today && tournament.endDate >= today
    )
    .sort(
      (left, right) =>
        Number(right.priority) - Number(left.priority) ||
        left.id.localeCompare(right.id)
    )[0];
  const finishedTournament = enabledTournaments(tournaments)
    .filter((tournament) => tournament.endDate < today)
    .sort(
      (left, right) =>
        right.endDate.localeCompare(left.endDate) ||
        Number(right.priority) - Number(left.priority) ||
        left.id.localeCompare(right.id)
    )[0];

  if (currentTournament) {
    return {
      activeTournament: currentTournament,
      nextTournament: nextTournamentAfter(
        tournaments,
        today,
        currentTournament.id
      ),
      businessState: "NO_UPCOMING",
      selectedDate: null,
      matches: [],
      selectionReason: "SMART_NO_UPCOMING_MATCHES",
    };
  }

  if (finishedTournament) {
    return {
      activeTournament: finishedTournament,
      nextTournament: nextTournamentAfter(
        tournaments,
        today,
        finishedTournament.id
      ),
      businessState: "TOURNAMENT_FINISHED",
      selectedDate: null,
      matches: [],
      selectionReason: "SMART_TOURNAMENT_FINISHED",
    };
  }

  return {
    activeTournament: null,
    nextTournament: nextTournamentAfter(tournaments, today),
    businessState: "NO_UPCOMING",
    selectedDate: null,
    matches: [],
    selectionReason: "SMART_NO_UPCOMING_MATCHES",
  };
}

module.exports = {
  beijingDateString,
  matchDateString,
  selectTournament,
};
