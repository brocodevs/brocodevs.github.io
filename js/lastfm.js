const LASTFM_WORKER_URL = "https://lastfm.broco.workers.dev/";

const REFRESH_MS = 60000;

function relativeTime(utsSeconds) {
  const then = Number(utsSeconds) * 1000;
  if (!Number.isFinite(then)) return "";

  const diff = Date.now() - then;
  if (diff < 0) return "";

  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;

  return `${Math.floor(days / 30)}mo ago`;
}

function coverArt(track) {
  const images = (track && track.image) || [];
  const preferred = ["extralarge", "large", "medium", "small"];
  for (const size of preferred) {
    const match = images.find((img) => img && img.size === size);
    const url = match && (match["#text"] || "");
    if (url) return url;
  }
  return "";
}

function firstTrack(data) {
  const tracks = data && data.recenttracks && data.recenttracks.track;
  if (!tracks) return null;
  return Array.isArray(tracks) ? tracks[0] || null : tracks;
}

export function initLastfm() {
  const el = document.getElementById("hero-now");
  const textEl = document.getElementById("hero-now-text");
  const timeEl = document.getElementById("hero-now-time");
  const coverEl = document.getElementById("hero-now-cover");
  const dotEl = el && el.querySelector(".hero-now-dot");
  if (!el || !textEl || !timeEl) return;
  if (!LASTFM_WORKER_URL) return;

  let timer = null;

  async function update() {
    try {
      const res = await fetch(LASTFM_WORKER_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("worker error");
      const data = await res.json();
      const track = firstTrack(data);
      if (!track || !track.name) throw new Error("no track");

      const artist =
        (track.artist && (track.artist["#text"] || track.artist)) || "";
      const isNowPlaying = track["@attr"] && track["@attr"].nowplaying === "true";

      textEl.textContent = artist ? `${track.name} · ${artist}` : track.name;
      timeEl.textContent = isNowPlaying
        ? "Now playing"
        : relativeTime(track.date && track.date.uts);

      const art = coverArt(track);
      if (coverEl) {
        if (art) coverEl.src = art;
        coverEl.hidden = !art;
      }
      if (dotEl) dotEl.hidden = Boolean(art);

      el.classList.toggle("is-live", Boolean(isNowPlaying));
      el.href = track.url || "https://www.last.fm/user/BrocoDev";
      el.hidden = false;
    } catch (_) {
      el.hidden = true;
    }
  }

  update();
  timer = window.setInterval(update, REFRESH_MS);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (timer) clearInterval(timer);
      timer = null;
    } else if (!timer) {
      update();
      timer = window.setInterval(update, REFRESH_MS);
    }
  });
}
