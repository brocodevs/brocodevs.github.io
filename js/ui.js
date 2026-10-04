import { initLastfm } from "./lastfm.js";

export function initUI() {
  initTypingRole();
  initLastfm();
  initThemeToggle();
  initReveal();
  initScrollProgress();
  initLightbox();
  initNotes();
  initGalleries().finally(initMarquees);
}

function initTypingRole() {
  const textEl = document.getElementById("typing-text");
  if (!textEl) return;

  const roles = ["Designer.", "Developer.", "Founder.", "Photographer.", "Producer."];

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    textEl.textContent = roles[0];
    return;
  }

  const TYPE_MS = 70;
  const HOLD_MS = 1800;
  const DELETE_MS = 38;

  let roleIndex = 0;
  let charIndex = 0;
  let deleting = false;

  function step() {
    const role = roles[roleIndex];

    if (deleting) {
      charIndex--;
      textEl.textContent = role.substring(0, charIndex);
      if (charIndex === 0) {
        deleting = false;
        roleIndex = (roleIndex + 1) % roles.length;
        setTimeout(step, 250);
        return;
      }
      setTimeout(step, DELETE_MS);
      return;
    }

    charIndex++;
    textEl.textContent = role.substring(0, charIndex);
    if (charIndex === role.length) {
      deleting = true;
      setTimeout(step, HOLD_MS);
      return;
    }
    setTimeout(step, TYPE_MS);
  }

  setTimeout(step, 400);
}

function initThemeToggle() {
  const root = document.documentElement;
  const themeBtn = document.getElementById("dock-theme-btn");

  let pendingSwapTimer = null;
  let pendingCleanupTimer = null;

  function applyTheme(t) {
    root.setAttribute("data-theme", t);
    try {
      localStorage.setItem("brocodev-theme", t);
    } catch (_) {}
  }

  applyTheme(localStorage.getItem("brocodev-theme") || "dark");
  if (!themeBtn) return;

  function setTheme(t) {
    const prevT = root.getAttribute("data-theme");
    if (prevT === t) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (pendingSwapTimer) clearTimeout(pendingSwapTimer);
    if (pendingCleanupTimer) clearTimeout(pendingCleanupTimer);

    const dockIcons = themeBtn.querySelector(".dock-theme-icons");
    if (!dockIcons) {
      applyTheme(t);
      return;
    }

    const fromRot = parseInt(dockIcons.dataset.flipRot || "0", 10);
    const toRot = fromRot + 180;

    dockIcons.dataset.flipRot = String(toRot);
    dockIcons.style.setProperty("--flip-from", fromRot + "deg");
    dockIcons.style.setProperty("--flip-to", toRot + "deg");

    if (reduced) {
      applyTheme(t);
      dockIcons.style.transform = `rotateY(${toRot}deg)`;
      return;
    }

    dockIcons.style.transform = `rotateY(${fromRot}deg)`;

    themeBtn.classList.remove("is-spinning");
    void themeBtn.offsetWidth;
    themeBtn.classList.add("is-spinning");

    pendingSwapTimer = setTimeout(() => {
      applyTheme(t);
      pendingSwapTimer = null;
    }, 325);

    pendingCleanupTimer = setTimeout(() => {
      themeBtn.classList.remove("is-spinning");
      dockIcons.style.transform = `rotateY(${toRot}deg)`;
      pendingCleanupTimer = null;
    }, 670);
  }

  themeBtn.addEventListener("click", () => {
    const current = root.getAttribute("data-theme");
    setTheme(current === "dark" ? "light" : "dark");
  });
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function initReveal() {
  const els = Array.from(document.querySelectorAll("[data-reveal]"));
  if (!els.length) return;

  if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.12 },
  );

  els.forEach((el) => io.observe(el));
}

function initScrollProgress() {
  const bar = document.querySelector(".scroll-progress-bar");
  if (!bar) return;

  let ticking = false;

  function update() {
    ticking = false;
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    bar.style.transform = `scaleX(${progress})`;
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  update();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
}

function initMarquees() {
  const carousels = Array.from(document.querySelectorAll(".carousel"));
  if (!carousels.length) return;

  const SPEED = 32; // pixels per second

  carousels.forEach((carousel) => {
    if (!carousel.__originals) {
      carousel.__originals = Array.from(carousel.children).filter(
        (el) => el.nodeType === 1,
      );
    }
  });

  function build(carousel) {
    const originals = carousel.__originals;
    if (!originals || !originals.length) return;

    carousel.classList.remove("is-marquee");
    carousel.style.removeProperty("--marquee-duration");
    carousel.style.removeProperty("--marquee-shift");
    carousel.textContent = "";

    const track = document.createElement("div");
    track.className = "carousel-track";
    originals.forEach((item) => track.appendChild(item));
    carousel.appendChild(track);

    if (prefersReducedMotion()) return;

    const styles = getComputedStyle(track);
    const gap = parseFloat(styles.columnGap) || parseFloat(styles.gap) || 16;
    const setWidth = track.scrollWidth;
    const containerWidth = carousel.clientWidth;
    if (!setWidth || !containerWidth) return;

    const unit = setWidth + gap;
    const needed = containerWidth + unit;
    let guard = 0;
    while (track.scrollWidth < needed && guard < 60) {
      originals.forEach((item) => track.appendChild(item.cloneNode(true)));
      guard += 1;
    }

    carousel.classList.add("is-marquee");
    carousel.style.setProperty("--marquee-shift", `-${unit}px`);
    carousel.style.setProperty(
      "--marquee-duration",
      `${Math.max(8, unit / SPEED).toFixed(1)}s`,
    );
  }

  function buildAll() {
    carousels.forEach(build);
  }

  buildAll();

  let lastWidth = window.innerWidth;
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(buildAll, 200);
  });
}

function isPlainClick(event) {
  return !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
}

function openOverlay(overlay, trigger) {
  overlay.__trigger = trigger || null;
  if (typeof overlay.showModal === "function") {
    if (!overlay.open) overlay.showModal();
  } else {
    overlay.setAttribute("open", "");
  }
  document.body.classList.add("modal-open");
}

function closeOverlay(overlay) {
  if (typeof overlay.close === "function") overlay.close();
  else overlay.removeAttribute("open");
}

function closeOnBackdrop(overlay) {
  overlay.addEventListener("close", () => {
    document.body.classList.remove("modal-open");
    const trigger = overlay.__trigger;
    overlay.__trigger = null;
    if (
      trigger &&
      typeof trigger.blur === "function" &&
      trigger.closest &&
      trigger.closest(".carousel")
    ) {
      trigger.blur();
    }
  });

  overlay.addEventListener("click", (event) => {
    if (event.target !== overlay) return;
    closeOverlay(overlay);
  });
}

function resolveAssetPath(value) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (
    value.startsWith("/") ||
    value.startsWith("./") ||
    value.startsWith("../")
  ) {
    return value;
  }
  return "/" + value;
}

function renderGallery(carousel, items) {
  carousel.innerHTML = "";

  items.forEach((entry) => {
    const src = resolveAssetPath(
      typeof entry === "string" ? entry : entry && entry.src,
    );
    if (!src) return;
    const alt = typeof entry === "string" ? "" : (entry && entry.alt) || "";

    const link = document.createElement("a");
    link.className = "carousel-item";
    link.href = src;
    link.setAttribute("data-lightbox", "");
    if (alt) link.setAttribute("aria-label", alt);

    const img = document.createElement("img");
    img.src = src;
    img.alt = alt;
    img.loading = "lazy";
    img.decoding = "async";

    link.appendChild(img);
    carousel.appendChild(link);
  });
}

async function initGalleries() {
  const carousels = Array.from(document.querySelectorAll("[data-gallery]"));
  if (!carousels.length) return;

  await Promise.all(
    carousels.map(async (carousel) => {
      const name = carousel.getAttribute("data-gallery");
      if (!name) return;
      try {
        const res = await fetch(`/assets/photos/${name}/gallery.json`, {
          cache: "no-cache",
        });
        if (!res.ok) throw new Error("missing manifest");
        const data = await res.json();
        const items = Array.isArray(data) ? data : (data && data.items) || [];
        if (items.length) renderGallery(carousel, items);
      } catch (_) {}
    }),
  );
}

async function initNotes() {
  const list = document.getElementById("notes-list");
  if (!list) return;

  const empty = document.getElementById("notes-empty");

  try {
    const res = await fetch("/posts/posts.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("missing posts index");
    const data = await res.json();
    const posts = (data.posts || [])
      .slice()
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

    if (!posts.length) {
      if (empty) empty.hidden = false;
      return;
    }

    posts.forEach((post) => {
      const link = document.createElement("a");
      link.className = "note-card";
      link.href = `/note/?slug=${encodeURIComponent(post.slug)}`;

      const body = document.createElement("span");
      const title = document.createElement("span");
      title.className = "note-card-title";
      title.textContent = post.title || post.slug;
      body.appendChild(title);

      if (post.subtitle) {
        const sub = document.createElement("span");
        sub.className = "note-card-sub";
        sub.textContent = post.subtitle;
        body.appendChild(sub);
      }
      link.appendChild(body);

      if (post.date) {
        const date = document.createElement("span");
        date.className = "note-card-date";
        date.textContent = post.date;
        link.appendChild(date);
      }

      list.appendChild(link);
    });
  } catch (_) {
    if (empty) empty.hidden = false;
  }
}

function initLightbox() {
  const lightbox = document.getElementById("lightbox");
  if (!lightbox) return;

  const image = lightbox.querySelector(".lightbox-img");
  if (!image) return;

  const ready = new Map();

  function preloadPreview(src) {
    if (!ready.has(src)) {
      ready.set(
        src,
        new Promise((resolve) => {
          const pre = new Image();
          pre.decoding = "async";
          pre.onload = () => {
            if (typeof pre.decode === "function") {
              pre.decode().then(resolve, resolve);
            } else {
              resolve();
            }
          };
          pre.onerror = resolve;
          pre.src = src;
        }),
      );
    }
    return ready.get(src);
  }

  document.addEventListener("click", (event) => {
    const trigger =
      event.target && event.target.closest
        ? event.target.closest("[data-lightbox]")
        : null;
    if (!trigger) return;
    if (!isPlainClick(event)) return;
    event.preventDefault();

    const inner = trigger.querySelector("img");
    const src = trigger.getAttribute("href") || (inner ? inner.src : "");
    if (!src) return;
    const alt = inner ? inner.alt : "";

    if (image.getAttribute("src") !== src) {
      image.removeAttribute("src");
      image.alt = "";
    }

    openOverlay(lightbox, trigger);

    preloadPreview(src).then(() => {
      image.src = src;
      image.alt = alt;
    });
  });

  closeOnBackdrop(lightbox);
}
