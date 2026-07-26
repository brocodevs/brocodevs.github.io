const CACHE_KEY = "brocodev-lastfm-recent-v2";
const CACHE_TTL_MS = 30 * 60 * 1000;
const WORKER_URL = "https://lastfm.broco.workers.dev/api/recent";
const MAX_RETRIES = 2;
const BACKOFF_BASE_MS = 800;

try {
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem("brocodev-lastfm-recent-v1");
} catch (_) {}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    if (!payload || typeof payload.ts !== "number") return null;
    if (Date.now() - payload.ts > CACHE_TTL_MS) return null;
    return payload.data || null;
  } catch (_) {
    return null;
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch (_) {}
}

function normalize(track) {
  if (!track) return null;
  const name = typeof track.name === "string" ? track.name.trim() : "";
  const artist =
    track.artist && typeof track.artist === "object"
      ? (track.artist["#text"] || "").trim()
      : "";
  if (!name || !artist) return null;
  const images = Array.isArray(track.image) ? track.image : [];
  const cover =
    (images.find((img) => img && img.size === "extralarge") ||
      images.find((img) => img && img.size === "mega") ||
      images.find((img) => img && img.size === "large") ||
      images[images.length - 1] ||
      {})["#text"] || "";
  const nowPlaying = !!(track["@attr"] && track["@attr"].nowplaying === "true");
  const date =
    track.date && track.date.uts ? parseInt(track.date.uts, 10) * 1000 : null;
  return {
    title: name,
    artist: artist,
    album: (track.album && track.album["#text"]) || "",
    cover,
    nowPlaying,
    url: typeof track.url === "string" ? track.url : "",
    date,
  };
}

async function fetchOnce() {
  const resp = await fetch(WORKER_URL);
  if (!resp.ok) {
    const err = new Error("HTTP " + resp.status);
    err.retryable = resp.status >= 500 || resp.status === 429;
    throw err;
  }
  const json = await resp.json();
  const rawTrack = json?.recenttracks?.track?.[0];
  if (!rawTrack) return null;

  return normalize(rawTrack);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getRecent() {
  const cached = readCache();
  if (cached) return cached;

  let lastErr = null;
  let attemptsMade = 0;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    attemptsMade = attempt + 1;
    try {
      const data = await fetchOnce();
      if (data) {
        writeCache(data);
        return data;
      }

      return null;
    } catch (err) {
      lastErr = err;

      if (err.retryable === false || attempt === MAX_RETRIES) break;

      await sleep(BACKOFF_BASE_MS * Math.pow(2, attempt));
    }
  }

  console.error(
    "[lastfm] Worker fetch failed after " + attemptsMade + " attempt(s):",
    lastErr && lastErr.message ? lastErr.message : lastErr,
  );
  return null;
}
