import { initUI } from "/js/ui.js";

const POSTS_JSON_URL = "/posts/posts.json";

function getMarkedParse() {
  const lib = window.marked;
  if (!lib) return null;
  if (typeof lib === "function") return lib;
  if (typeof lib.parse === "function") return lib.parse.bind(lib);
  if (lib.marked && typeof lib.marked.parse === "function") {
    return lib.marked.parse.bind(lib.marked);
  }
  return null;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderMarkdown(markdown) {
  const parse = getMarkedParse();
  if (!parse) return `<p>${escapeHtml(markdown)}</p>`;
  try {
    return parse(markdown, { gfm: true, breaks: true });
  } catch (_) {
    return `<p>${escapeHtml(markdown)}</p>`;
  }
}

function slugFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("slug") || "").trim();
}

function resolvePostImage(value) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return value;
  if (value.startsWith("./") || value.startsWith("../")) return value;
  return "/posts/" + value;
}

async function loadNote() {
  const slug = slugFromUrl();
  const titleEl = document.getElementById("note-title");
  const subtitleEl = document.getElementById("note-subtitle");
  const contentEl = document.getElementById("note-content");
  const coverBlock = document.getElementById("note-cover-block");
  const coverImg = document.getElementById("note-cover");

  if (!slug) {
    if (titleEl) titleEl.textContent = "Note not found";
    return;
  }

  let post = null;
  try {
    const res = await fetch(POSTS_JSON_URL, { cache: "no-cache" });
    const data = await res.json();
    post = (data.posts || []).find((p) => p.slug === slug) || null;
  } catch (_) {
    post = null;
  }

  if (post) {
    document.title = `${post.title} · Christian / BrocoDev`;
    if (titleEl) titleEl.textContent = post.title || "";
    if (subtitleEl) subtitleEl.textContent = post.subtitle || "";
    if (post.image && coverImg && coverBlock) {
      coverImg.src = resolvePostImage(post.image);
      coverImg.alt = post.title || "";
      coverBlock.hidden = false;
    }
  } else if (titleEl) {
    titleEl.textContent = slug;
  }

  try {
    const res = await fetch(`/posts/${slug}/index.md`, { cache: "no-cache" });
    if (!res.ok) throw new Error("missing");
    const markdown = await res.text();
    if (contentEl) {
      contentEl.innerHTML = renderMarkdown(markdown);
    }
  } catch (_) {
    if (contentEl) {
      contentEl.innerHTML = "<p>Could not load this note.</p>";
    }
  }
}

initUI();
loadNote();
