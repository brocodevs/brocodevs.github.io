import { initUI } from "./ui.js";

const POSTS_JSON_URL = "./posts/posts.json";
const POSTS_DIR = "./posts/";
const POST_BODY_CACHE = new Map();

const state = {
  posts: [],
  postsBySlug: new Map(),
  tags: new Set(),
  activeTags: new Set(),
  listScrollTop: 0,
  currentPost: null,
  pendingRoute: null,
  inflightController: null,
};

const els = {
  listView: null,
  detailView: null,
  detail404: null,
  list: null,
  empty: null,
  loadError: null,
  loadErrorMsg: null,
  filterRow: null,
  detailCover: null,
  detailCoverBlock: null,
  detailDateMeta: null,
  detailTitle: null,
  detailSubtitle: null,
  detailTagsInline: null,
  detailContent: null,
  detailSkeleton: null,
  topBar: null,
  dockNavBtn: null,
  dockNavIcon: null,
  clearFiltersBtn: null,
  retryBtn: null,
};

const bodyEl = document.body;

function init() {
  if (!window.marked) {
    console.error("[blog] marked.js failed to load; aborting.");
    showLoadError("Markdown parser did not load.");
    return;
  }

  initUI();
  configureMarked();

  cacheElements();
  attachListeners();

  const initialHash = parseHash(window.location.hash);
  if (initialHash && initialHash.kind === "post") {
    state.pendingRoute = initialHash.slug;
  }

  loadPosts()
    .then(() => {
      renderFilterRow();
      if (state.pendingRoute) {
        const slug = state.pendingRoute;
        state.pendingRoute = null;
        showPost(slug, { initial: true });
      } else {
        renderList();
      }
    })
    .catch((err) => {
      showLoadError(err && err.message ? err.message : "Unknown error");
    });
}

function configureMarked() {
  const marked = window.marked;
  marked.setOptions({
    gfm: true,
    breaks: false,
    headerIds: false,
    mangle: false,
    smartypants: false,
  });

  marked.use({
    renderer: {
      image(href, title, text) {
        const safeHref = escape(String(href || ""));
        const titleAttr = title ? ` title="${escape(String(title))}"` : "";
        return `<img src="${safeHref}"${titleAttr} loading="lazy" decoding="async">`;
      },
      link(href, title, text) {
        const safeHref = String(href || "");
        const isExternal = /^https?:\/\//i.test(safeHref);
        const target = isExternal ? ' target="_blank"' : "";
        const rel = isExternal ? ' rel="noopener noreferrer"' : "";
        const titleAttr = title ? ` title="${escape(String(title))}"` : "";
        return `<a href="${escape(safeHref)}"${target}${rel}${titleAttr}>${text}</a>`;
      },
    },
  });
}

function escape(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function capitalizeWords(s) {
  return String(s == null ? "" : s)
    .split(/(\s+|-|_)/)
    .map((part) =>
      /\s+|-|_/.test(part)
        ? part
        : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join("");
}

function resolvePostImageUrl(image) {
  if (!image) return "";
  const s = String(image).trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/")) return s;
  if (s.startsWith("./") || s.startsWith("../")) return s;
  if (s.startsWith("posts/")) return "./" + s;
  return "./posts/" + s;
}

function cacheElements() {
  els.listView = document.getElementById("blog-list-view");
  els.detailView = document.getElementById("blog-detail-view");
  els.detail404 = document.getElementById("blog-detail-404");
  els.list = document.getElementById("blog-list");
  els.empty = document.getElementById("blog-empty");
  els.loadError = document.getElementById("blog-load-error");
  els.loadErrorMsg = document.getElementById("blog-load-error-msg");
  els.filterRow = document.getElementById("blog-filter-row");
  els.detailCover = document.getElementById("blog-detail-cover-img");
  els.detailCoverBlock = document.getElementById("blog-detail-cover-block");
  els.detailDateMeta = document.getElementById("blog-detail-date-meta");
  els.detailTitle = document.getElementById("blog-detail-title");
  els.detailSubtitle = document.getElementById("blog-detail-subtitle");
  els.detailTagsInline = document.getElementById("blog-detail-tags-inline");
  els.detailContent = document.getElementById("blog-detail-content");
  els.detailSkeleton = document.getElementById("blog-detail-skeleton");
  els.dockNavBtn = document.getElementById("dock-blog-nav-btn");
  els.dockNavIcon = document.getElementById("dock-blog-nav-icon");
  els.clearFiltersBtn = document.getElementById("blog-clear-filters-btn");
  els.retryBtn = document.getElementById("blog-retry-btn");
}

function attachListeners() {
  window.addEventListener("hashchange", onHashChange);

  if (els.dockNavBtn) {
    els.dockNavBtn.addEventListener("click", onDockNavClick);
  }
  if (els.clearFiltersBtn) {
    els.clearFiltersBtn.addEventListener("click", clearFilters);
  }
  if (els.retryBtn) {
    els.retryBtn.addEventListener("click", retryLoadPosts);
  }
}

function parseHash(hash) {
  if (!hash) return null;
  const cleaned = hash.replace(/^#/, "");
  if (!cleaned) return null;
  const m = /^post\/(.+)$/.exec(cleaned);
  if (m) return { kind: "post", slug: decodeURIComponent(m[1]) };
  return null;
}

function onHashChange() {
  const parsed = parseHash(window.location.hash);
  if (parsed && parsed.kind === "post") {
    showPost(parsed.slug);
  } else {
    showList({ skipHistory: true });
  }
}

async function loadPosts() {
  let resp;
  try {
    resp = await fetch(POSTS_JSON_URL, { cache: "no-cache" });
  } catch (err) {
    throw new Error("Network error while fetching posts.json");
  }
  if (!resp.ok) {
    throw new Error("HTTP " + resp.status + " fetching posts.json");
  }
  const json = await resp.json();
  if (!json || !Array.isArray(json.posts)) {
    throw new Error("posts.json is malformed");
  }
  const posts = json.posts.slice().sort((a, b) => {
    const ta = parseDate(a.date);
    const tb = parseDate(b.date);
    return (tb || 0) - (ta || 0);
  });
  state.posts = posts;
  state.postsBySlug = new Map(posts.map((p) => [p.slug, p]));
  state.tags = new Set();
  posts.forEach((p) => (p.tags || []).forEach((t) => state.tags.add(t)));
}

function parseDate(s) {
  if (!s) return 0;
  const t = Date.parse(s);
  return isNaN(t) ? 0 : t;
}

function formatDate(iso) {
  const ts = parseDate(iso);
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function renderFilterRow() {
  if (els.filterRow) els.filterRow.innerHTML = "";
  if (!els.filterRow) return;

  const allBtn = makeFilterPill("all", "All", null);
  els.filterRow.appendChild(allBtn);

  const tagsArr = Array.from(state.tags).sort((a, b) => a.localeCompare(b));
  tagsArr.forEach((tag) => {
    const pill = makeFilterPill("tag", tag, tag);
    els.filterRow.appendChild(pill);
  });

  updateFilterRowActive();
}

function makeFilterPill(kind, label, value) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "blog-filter-pill btn-pill";
  btn.dataset.kind = kind;
  if (value !== null && value !== undefined) btn.dataset.value = value;
  btn.textContent = capitalizeWords(label);
  btn.addEventListener("click", () => onFilterClick(kind, value));
  return btn;
}

function onFilterClick(kind, value) {
  if (kind === "all") {
    state.activeTags.clear();
  } else if (value) {
    if (state.activeTags.has(value)) {
      state.activeTags.delete(value);
    } else {
      state.activeTags.add(value);
    }
  }

  if (state.currentPost) {
    navigateToList();
  } else {
    renderList();
  }
}

function clearFilters() {
  state.activeTags.clear();
  renderList();
}

function updateFilterRowActive() {
  if (!els.filterRow) return;
  const buttons = els.filterRow.querySelectorAll(".blog-filter-pill");
  buttons.forEach((btn) => {
    const kind = btn.dataset.kind;
    const v = btn.dataset.value;
    let isActive = false;
    if (kind === "all") {
      isActive = state.activeTags.size === 0;
    } else {
      isActive = state.activeTags.has(v);
    }
    btn.classList.toggle("is-active", isActive);
  });
}

function onDockNavClick(e) {
  e.preventDefault();
  const isArticle =
    bodyEl &&
    (bodyEl.classList.contains("is-article") ||
      bodyEl.classList.contains("is-article-404"));
  if (isArticle) {
    navigateToList();
  } else {
    window.location.href = "./";
  }
}

function updateDockForView() {
  if (!els.dockNavBtn || !els.dockNavIcon) return;
  const isArticle =
    bodyEl &&
    (bodyEl.classList.contains("is-article") ||
      bodyEl.classList.contains("is-article-404"));
  if (isArticle) {
    els.dockNavIcon.setAttribute("icon", "solar:logout-2-bold-duotone");
    els.dockNavBtn.setAttribute("title", "Exit to all posts");
  } else {
    els.dockNavIcon.setAttribute("icon", "solar:home-angle-bold-duotone");
    els.dockNavBtn.setAttribute("title", "Back to Portfolio");
  }
}

function renderList() {
  state.currentPost = null;

  if (bodyEl) {
    bodyEl.classList.remove("is-article", "is-article-404");
    bodyEl.classList.add("is-list");
    updateDockForView();
  }

  if (!els.list || !els.listView) return;

  showElement(els.listView);
  hideElement(els.detailView);
  hideElement(els.detail404);

  const filtered =
    state.activeTags.size === 0
      ? state.posts
      : state.posts.filter((p) => {
          const tags = p.tags || [];
          for (const t of state.activeTags) {
            if (!tags.includes(t)) return false;
          }
          return true;
        });

  els.list.innerHTML = "";
  updateFilterRowActive();

  if (filtered.length === 0) {
    hideElement(els.list);
    showElement(els.empty);
    return;
  }

  showElement(els.list);
  hideElement(els.empty);

  const frag = document.createDocumentFragment();
  filtered.forEach((post, idx) => {
    frag.appendChild(makeCard(post, idx));
  });
  els.list.appendChild(frag);
}

function makeCard(post, idx) {
  const card = document.createElement("a");
  card.className = "blog-card";
  card.href = `#post/${encodeURIComponent(post.slug)}`;
  card.style.setProperty("--card-stagger", idx * 60 + "ms");

  const banner = document.createElement("div");
  banner.className = "blog-card-banner";
  if (post.image) {
    banner.style.backgroundImage = `url("${resolvePostImageUrl(post.image)}")`;
  }
  banner.setAttribute("role", "img");
  banner.setAttribute("aria-label", post.title || "");
  card.appendChild(banner);

  const body = document.createElement("div");
  body.className = "blog-card-body";
  card.appendChild(body);

  const top = document.createElement("div");
  top.className = "blog-card-body-top";
  body.appendChild(top);

  const title = document.createElement("h2");
  title.className = "blog-card-title";
  title.textContent = post.title || "";
  top.appendChild(title);

  if (post.subtitle) {
    const sub = document.createElement("p");
    sub.className = "blog-card-subtitle";
    sub.textContent = post.subtitle;
    top.appendChild(sub);
  }

  const metaRow = document.createElement("div");
  metaRow.className = "blog-card-meta-row";

  if (post.tags && post.tags.length) {
    const tagsRow = document.createElement("div");
    tagsRow.className = "blog-card-tags";
    post.tags.forEach((t) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "btn-pill btn-pill--sm";
      chip.textContent = capitalizeWords(t);
      chip.dataset.value = t;
      chip.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!state.activeTags.has(t)) {
          state.activeTags.add(t);
        } else {
          state.activeTags.delete(t);
        }
        renderList();
      });
      tagsRow.appendChild(chip);
    });
    metaRow.appendChild(tagsRow);
  }

  const date = formatDate(post.date);
  if (date) {
    const datePill = document.createElement("span");
    datePill.className = "blog-card-date btn-pill btn-pill--sm";
    datePill.textContent = date;
    metaRow.appendChild(datePill);
  }

  if (metaRow.childElementCount > 0) {
    top.appendChild(metaRow);
  }

  return card;
}

async function showPost(slug, opts) {
  opts = opts || {};
  const post = state.postsBySlug.get(slug);

  if (!post) {
    show404();
    return;
  }

  if (state.inflightController) {
    state.inflightController.abort();
  }
  const controller = new AbortController();
  state.inflightController = controller;

  if (!state.currentPost) {
    state.listScrollTop = window.scrollY;
  }

  if (bodyEl) {
    bodyEl.classList.remove("is-list");
    bodyEl.classList.add("is-article");
    updateDockForView();
  }

  hideElement(els.listView);
  hideElement(els.detail404);
  showElement(els.detailView);

  if (els.detailTitle) els.detailTitle.textContent = post.title || "";
  if (els.detailSubtitle) els.detailSubtitle.textContent = post.subtitle || "";

  if (post.image) {
    els.detailCoverBlock.removeAttribute("hidden");
    els.detailCover.src = resolvePostImageUrl(post.image);
    els.detailCover.alt = "";
  } else {
    els.detailCoverBlock.setAttribute("hidden", "");
    els.detailCover.removeAttribute("src");
  }

  renderDetailDateMeta(post);
  renderDetailTagsInline(post);
  renderDetailContentSkeleton();

  state.currentPost = post;

  if (els.detailView) {
    window.scrollTo({ top: 0, behavior: opts.initial ? "auto" : "smooth" });
  }

  try {
    const md = await fetchPostBody(slug, controller.signal);
    if (controller.signal.aborted) return;
    renderPostBody(post, md);
  } catch (err) {
    if (err && err.name === "AbortError") return;
    if (els.detailContent) {
      els.detailContent.innerHTML =
        `<p class="blog-error">Couldn't load this post. ${escape(err && err.message ? err.message : "Network error")}.</p>` +
        `<p><button type="button" class="blog-inline-retry" data-slug="${escape(slug)}">Try again</button></p>`;
      const retry = els.detailContent.querySelector(".blog-inline-retry");
      if (retry) {
        retry.addEventListener("click", () => showPost(slug));
      }
    }
  } finally {
    if (state.inflightController === controller) {
      state.inflightController = null;
    }
  }
}

function renderDetailDateMeta(post) {
  if (!els.detailDateMeta) return;
  const date = formatDate(post.date);
  if (!date) {
    els.detailDateMeta.setAttribute("hidden", "");
    return;
  }
  els.detailDateMeta.removeAttribute("hidden");
  els.detailDateMeta.textContent = date;
}

function renderDetailTagsInline(post) {
  if (!els.detailTagsInline) return;
  els.detailTagsInline.innerHTML = "";
  if (!post.tags || !post.tags.length) {
    els.detailTagsInline.setAttribute("hidden", "");
    return;
  }
  els.detailTagsInline.removeAttribute("hidden");
  post.tags.forEach((t) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "btn-pill btn-pill--sm";
    chip.textContent = capitalizeWords(t);
    chip.dataset.value = t;
    chip.addEventListener("click", () => {
      if (!state.activeTags.has(t)) state.activeTags.add(t);
      navigateToList({ fromDetailTag: true });
    });
    els.detailTagsInline.appendChild(chip);
  });
}

function renderDetailContentSkeleton() {
  if (!els.detailContent) return;
  els.detailContent.innerHTML = "";
  if (els.detailSkeleton) {
    els.detailContent.appendChild(els.detailSkeleton);
    els.detailSkeleton.removeAttribute("hidden");
  }
}

function renderPostBody(post, md) {
  if (!els.detailContent) return;
  if (els.detailSkeleton) els.detailSkeleton.setAttribute("hidden", "");

  let html;
  try {
    html = window.marked.parse(md || "");
  } catch (err) {
    els.detailContent.innerHTML = `<p class="blog-error">Couldn't render this post: ${escape(err.message || "parser error")}.</p>`;
    return;
  }
  els.detailContent.innerHTML = html;
}

async function fetchPostBody(slug, signal) {
  if (POST_BODY_CACHE.has(slug)) return POST_BODY_CACHE.get(slug);

  const url = POSTS_DIR + encodeURIComponent(slug) + "/index.md";
  let resp;
  try {
    resp = await fetch(url, { cache: "no-cache", signal });
  } catch (err) {
    if (err && err.name === "AbortError") throw err;
    throw new Error("Network error");
  }
  if (!resp.ok) {
    throw new Error("HTTP " + resp.status);
  }
  const text = await resp.text();
  POST_BODY_CACHE.set(slug, text);
  return text;
}

function navigateToList(opts) {
  opts = opts || {};
  if (state.inflightController) {
    state.inflightController.abort();
    state.inflightController = null;
  }

  state.currentPost = null;

  if (history && history.pushState) {
    history.pushState({ view: "list" }, "", "#");
  } else {
    window.location.hash = "";
  }

  showList();

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const target = opts.fromDetailTag ? 0 : state.listScrollTop || 0;
  if (!reduced) {
    requestAnimationFrame(() => {
      window.scrollTo({ top: target, behavior: "smooth" });
    });
  } else {
    window.scrollTo(0, target);
  }
}

function showList() {
  state.currentPost = null;
  hideElement(els.detailView);
  hideElement(els.detail404);
  showElement(els.listView);
  renderList();
}

function show404() {
  state.currentPost = null;
  if (bodyEl) {
    bodyEl.classList.remove("is-list");
    bodyEl.classList.add("is-article-404");
    updateDockForView();
  }
  hideElement(els.listView);
  hideElement(els.detailView);
  showElement(els.detail404);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showElement(el) {
  if (!el) return;
  el.removeAttribute("hidden");
}

function hideElement(el) {
  if (!el) return;
  el.setAttribute("hidden", "");
}

function showLoadError(msg) {
  if (els.listView) {
    els.listView.removeAttribute("hidden");
  }
  if (els.list) els.list.innerHTML = "";
  if (els.empty) els.empty.setAttribute("hidden", "");
  if (els.loadError) {
    els.loadError.removeAttribute("hidden");
    if (els.loadErrorMsg)
      els.loadErrorMsg.textContent = msg || "Something went wrong.";
  }
}

function retryLoadPosts() {
  if (els.loadError) els.loadError.setAttribute("hidden", "");
  loadPosts()
    .then(() => {
      renderFilterRow();
      if (state.pendingRoute) {
        const slug = state.pendingRoute;
        state.pendingRoute = null;
        showPost(slug, { initial: true });
      } else {
        renderList();
      }
    })
    .catch((err) => {
      showLoadError(err && err.message ? err.message : "Unknown error");
    });
}

window.addEventListener("popstate", () => {
  const parsed = parseHash(window.location.hash);
  if (parsed && parsed.kind === "post") {
    showPost(parsed.slug, { initial: true });
  } else {
    showList();
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const target = state.listScrollTop || 0;
    if (!reduced) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: target, behavior: "smooth" });
      });
    } else {
      window.scrollTo(0, target);
    }
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
