// Personal Scriptable storage and API access. No key or schedule is published.
const CACHE_FILE = "lpl-worlds-cito-personal-v1.json";
const BACKUP_FILE = "lpl-worlds-cito-personal-v1.previous.json";
const BACKOFF_FILE = "lpl-worlds-cito-personal-v1.backoff.json";
const FRESH_MS = 3 * 3600_000;
const STALE_LIMIT_MS = 24 * 3600_000;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function personalPaths(fm) {
  const directory = fm.documentsDirectory();
  return {
    current: fm.joinPath(directory, CACHE_FILE),
    backup: fm.joinPath(directory, BACKUP_FILE),
    backoff: fm.joinPath(directory, BACKOFF_FILE),
  };
}

function parsePersonalCache(fm, filePath, now, convertCitoWorlds) {
  if (!fm.fileExists(filePath)) return null;
  try {
    const payload = JSON.parse(fm.readString(filePath));
    invariant(
      payload?.schemaVersion === 1 && Array.isArray(payload.pages),
      "Personal cache shape invalid"
    );
    const fetchedAt = Date.parse(payload.fetchedAt);
    invariant(
      Number.isFinite(fetchedAt) &&
        new Date(fetchedAt).toISOString() === payload.fetchedAt &&
        fetchedAt - now.getTime() <= 5 * 60_000,
      "Personal cache timestamp invalid"
    );
    const converted = convertCitoWorlds(payload.pages, {
      observedAt: payload.fetchedAt,
    });
    return {
      payload,
      schedule: converted.schedule,
      ageMs: Math.max(0, now.getTime() - fetchedAt),
    };
  } catch {
    return null;
  }
}

function readPersonalCache(fm, now, convertCitoWorlds) {
  const paths = personalPaths(fm);
  const current = parsePersonalCache(fm, paths.current, now, convertCitoWorlds);
  if (current) return { ...current, recovered: false };
  const backup = parsePersonalCache(fm, paths.backup, now, convertCitoWorlds);
  return backup ? { ...backup, recovered: true } : null;
}

function readBackoff(fm, now) {
  const filePath = personalPaths(fm).backoff;
  if (!fm.fileExists(filePath)) return { failures: 0, retryAt: 0 };
  try {
    const data = JSON.parse(fm.readString(filePath));
    const failures = Number(data.failures);
    const retryAt = Date.parse(data.retryAt);
    if (
      !Number.isInteger(failures) ||
      failures < 0 ||
      !Number.isFinite(retryAt)
    )
      return { failures: 0, retryAt: 0 };
    return { failures, retryAt: Math.min(retryAt, now.getTime() + 3600_000) };
  } catch {
    return { failures: 0, retryAt: 0 };
  }
}

function recordBackoff(fm, now, previousFailures, rateLimited) {
  const failures = Math.min(previousFailures + 1, 4);
  const minutes = rateLimited ? Math.min(15 * 2 ** (failures - 1), 60) : 5;
  fm.writeString(
    personalPaths(fm).backoff,
    JSON.stringify({
      failures,
      retryAt: new Date(now.getTime() + minutes * 60_000).toISOString(),
    })
  );
}

function writePersonalCache(fm, payload, now, convertCitoWorlds) {
  const paths = personalPaths(fm);
  const pending = `${paths.current}.pending`;
  const backupPending = `${paths.backup}.pending`;
  const content = JSON.stringify(payload);
  fm.writeString(pending, content);
  invariant(
    fm.readString(pending) === content,
    "Personal cache write incomplete"
  );
  invariant(
    parsePersonalCache(fm, pending, now, convertCitoWorlds),
    "Personal cache verification failed"
  );
  if (parsePersonalCache(fm, paths.current, now, convertCitoWorlds)) {
    if (fm.fileExists(backupPending)) fm.remove(backupPending);
    fm.copy(paths.current, backupPending);
    fm.move(backupPending, paths.backup);
  }
  fm.move(pending, paths.current);
}

function requestError(status) {
  const error = new Error(
    status === 429 ? "Cito API 限流" : "Cito API 请求失败"
  );
  error.rateLimited = status === 429;
  return error;
}

async function fetchPersonalPages({
  key,
  Request,
  isWidget,
  withTimeout,
  sourceUrl,
  leagueId,
  seasonYear,
}) {
  const pages = [];
  let offset = 0;
  const maxPages = isWidget ? 1 : 5;
  for (let index = 0; index < maxPages; index++) {
    const url = `${sourceUrl}?from=${seasonYear}-01-01&to=${seasonYear}-12-31&limit=100&offset=${offset}`;
    const request = new Request(url);
    request.headers = { "x-api-key": key, Accept: "application/json" };
    request.timeoutInterval = isWidget ? 5 : 10;
    request.onRedirect = (redirect) =>
      /^https:\/\/api\.citoapi\.com\//.test(String(redirect?.url || ""))
        ? redirect
        : null;
    let page;
    try {
      page = await withTimeout(
        () => request.loadJSON(),
        request.timeoutInterval,
        "Cito"
      );
    } catch {
      throw requestError(request.response?.statusCode);
    }
    if (request.response?.statusCode !== 200)
      throw requestError(request.response?.statusCode);
    invariant(
      page?.success === true && page?.data?.leagueId === leagueId,
      "Cito response identity invalid"
    );
    pages.push(page);
    if (page.data.hasMore === false) return pages;
    if (isWidget) throw new Error("Cito 赛程需要在应用内刷新分页");
    const nextOffset = page.data.nextOffset;
    invariant(
      Number.isInteger(nextOffset) && nextOffset > offset,
      "Cito pagination invalid"
    );
    offset = nextOffset;
  }
  throw new Error("Cito pagination exceeded limit");
}

async function loadPersonalCitoSchedule({
  key,
  fm,
  Request,
  convertCitoWorlds,
  sourceUrl,
  leagueId,
  now = new Date(),
  isWidget = false,
  withTimeout,
  forceRefresh = false,
  seasonYear = String(new Date(now.getTime() + 8 * 3600_000).getUTCFullYear()),
}) {
  invariant(typeof key === "string" && key.trim(), "Cito Keychain 未配置");
  invariant(/^20\d{2}$/.test(seasonYear), "Cito season year invalid");
  const cached = readPersonalCache(fm, now, convertCitoWorlds);
  const seasonCache =
    cached?.schedule?.tournamentId === `worlds-${seasonYear}` ? cached : null;
  if (seasonCache && seasonCache.ageMs < FRESH_MS && !forceRefresh)
    return {
      schedule: seasonCache.schedule,
      fetchedAt: seasonCache.payload.fetchedAt,
      cacheState: seasonCache.recovered ? "RECOVERED" : "FRESH",
      requests: 0,
    };
  const backoff = readBackoff(fm, now);
  if (backoff.retryAt <= now.getTime()) {
    try {
      const pages = await fetchPersonalPages({
        key,
        Request,
        isWidget,
        withTimeout,
        sourceUrl,
        leagueId,
        seasonYear,
      });
      const fetchedAt = now.toISOString();
      const converted = convertCitoWorlds(pages, {
        observedAt: fetchedAt,
        previousSchedule: seasonCache?.schedule || null,
      });
      invariant(!converted.audit.removedIds.length, "Cito 本次缺少已有比赛");
      writePersonalCache(
        fm,
        { schemaVersion: 1, fetchedAt, pages },
        now,
        convertCitoWorlds
      );
      const backoffPath = personalPaths(fm).backoff;
      if (fm.fileExists(backoffPath)) fm.remove(backoffPath);
      return {
        schedule: converted.schedule,
        fetchedAt,
        cacheState: "REFRESHED",
        requests: pages.length,
      };
    } catch (error) {
      try {
        recordBackoff(fm, now, backoff.failures, error.rateLimited === true);
      } catch {
        // A failed backoff write must not discard a valid local schedule.
      }
      if (!seasonCache || seasonCache.ageMs > STALE_LIMIT_MS)
        throw new Error(`Worlds 个人赛程不可用：${error.message}`);
    }
  } else if (!seasonCache || seasonCache.ageMs > STALE_LIMIT_MS) {
    throw new Error("Worlds 个人赛程过期，等待 Cito 重试");
  }
  return {
    schedule: seasonCache.schedule,
    fetchedAt: seasonCache.payload.fetchedAt,
    cacheState: seasonCache.recovered ? "RECOVERED_STALE" : "STALE",
    requests: 0,
  };
}

module.exports = {
  loadPersonalCitoSchedule,
  readPersonalCache,
  personalPaths,
};
