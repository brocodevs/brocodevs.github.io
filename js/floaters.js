import { getRecent } from "./lastfm.js";

export function initFloaters() {
  const homeSection = document.getElementById("home");
  if (!homeSection) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const socialsHstack = document.querySelector(".hero-socials-hstack");
  let lastfmWidget = null;
  if (socialsHstack) {
    lastfmWidget = document.createElement("a");
    lastfmWidget.className = "lastfm-widget btn-pill";
    lastfmWidget.target = "_blank";
    lastfmWidget.rel = "noopener noreferrer";
    lastfmWidget.innerHTML =
      '<span class="lastfm-widget-cover">' +
      '<div class="lastfm-shimmer"></div>' +
      "</span>" +
      '<span class="lastfm-widget-text">' +
      '<span class="lastfm-widget-title">—</span>' +
      '<span class="lastfm-widget-artist">' +
      '<span class="lastfm-widget-artist-name">loading…</span>' +
      '<span class="lastfm-widget-time"></span>' +
      "</span>" +
      "</span>" +
      '<iconify-icon icon="fa-brands:lastfm" class="lastfm-widget-logo"></iconify-icon>';
    socialsHstack.appendChild(lastfmWidget);
  }

  const FLOATER_IMAGES = [
    "./assets/floaters/banana.gif",
    "./assets/floaters/sonic.gif",
    "./assets/floaters/folk valley.gif",
    "./assets/floaters/woah.png",
    "./assets/floaters/fish.gif",
    "./assets/floaters/wave.gif",
    "./assets/floaters/kirb.gif",
  ];

  const PHYS = {
    MAX_DIM: window.innerWidth < 640 ? 80 : 140,
    DAMPING: 0.992,
    SPIN_DAMPING: 0.99,
    FLOATER_E: 0.92,
    OBSTACLE_E: 0.7,
    MAX_V: 14,

    MAX_ANG_V: 8,
    MAX_FLING_V: 22,
    FLING_BOOST: 1.25,
    FLING_BUF_MS: 120,

    BASELINE_SPIN: 0.3,
    OBSTACLE_E: 0.55,
    PROGRESSIVE_BLUR_MARGIN: 0,
    HULL_MARGIN: 8,
    BBOX_PAD_PX: 4,
  };

  const OBSTACLE_SELECTORS = [];

  const field = document.createElement("div");
  field.className = "floater-field";
  field.setAttribute("aria-hidden", "true");

  field.className = "floater-field";
  field.setAttribute("aria-hidden", "true");

  homeSection.insertBefore(field, homeSection.firstChild);

  function obbCorners(f) {
    const r = (f.rotation * Math.PI) / 180;
    const c = Math.cos(r),
      s = Math.sin(r);
    const hw = f.w / 2,
      hh = f.h / 2;
    return [
      { x: f.x + (-hw * c - -hh * s), y: f.y + (-hw * s + -hh * c) },
      { x: f.x + (hw * c - -hh * s), y: f.y + (hw * s + -hh * c) },
      { x: f.x + (hw * c - hh * s), y: f.y + (hw * s + hh * c) },
      { x: f.x + (-hw * c - hh * s), y: f.y + (-hw * s + hh * c) },
    ];
  }

  function obbAxes(f) {
    const r = (f.rotation * Math.PI) / 180;
    const c = Math.cos(r),
      s = Math.sin(r);
    return [
      { x: c, y: s },
      { x: -s, y: c },
    ];
  }

  function projectCorners(corners, axis) {
    let min = Infinity,
      max = -Infinity;
    for (const co of corners) {
      const p = co.x * axis.x + co.y * axis.y;
      if (p < min) min = p;
      if (p > max) max = p;
    }
    return { min, max };
  }

  function satObbObb(a, b) {
    const aC = obbCorners(a),
      bC = obbCorners(b);
    const axes = obbAxes(a).concat(obbAxes(b));
    let minOverlap = Infinity;
    let minAxis = null;
    for (const axis of axes) {
      const pa = projectCorners(aC, axis);
      const pb = projectCorners(bC, axis);
      const o = Math.min(pa.max, pb.max) - Math.max(pa.min, pb.min);
      if (o <= 0) return null;
      if (o < minOverlap) {
        minOverlap = o;
        minAxis = axis;
      }
    }
    const dx = b.x - a.x,
      dy = b.y - a.y;
    if (dx * minAxis.x + dy * minAxis.y < 0) {
      minAxis = { x: -minAxis.x, y: -minAxis.y };
    }
    return { overlap: minOverlap, axis: minAxis };
  }

  function satObbRect(f, rect) {
    const fAxes = obbAxes(f);
    const fC = obbCorners(f);
    const rC = [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.w, y: rect.y },
      { x: rect.x + rect.w, y: rect.y + rect.h },
      { x: rect.x, y: rect.y + rect.h },
    ];
    const axes = fAxes.concat([
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ]);
    let minOverlap = Infinity;
    let minAxis = null;
    for (const axis of axes) {
      const pa = projectCorners(fC, axis);
      const pb = projectCorners(rC, axis);
      const o = Math.min(pa.max, pb.max) - Math.max(pa.min, pb.min);
      if (o <= 0) return null;
      if (o < minOverlap) {
        minOverlap = o;
        minAxis = axis;
      }
    }

    const rectCX = rect.x + rect.w / 2;
    const rectCY = rect.y + rect.h / 2;
    const dx = f.x - rectCX,
      dy = f.y - rectCY;
    if (dx * minAxis.x + dy * minAxis.y < 0) {
      minAxis = { x: -minAxis.x, y: -minAxis.y };
    }
    return { overlap: minOverlap, axis: minAxis };
  }

  function clampVel(f) {
    const sp = Math.hypot(f.vx, f.vy);
    if (sp > PHYS.MAX_V) {
      const k = PHYS.MAX_V / sp;
      f.vx *= k;
      f.vy *= k;
    }
    if (f.angVel > PHYS.MAX_ANG_V) f.angVel = PHYS.MAX_ANG_V;
    if (f.angVel < -PHYS.MAX_ANG_V) f.angVel = -PHYS.MAX_ANG_V;
  }

  function applyTransform(f) {
    const tx = f.x - f.w / 2;
    const ty = f.y - f.h / 2;
    f.el.style.transform = `translate3d(${tx}px, ${ty}px, 0) rotate(${f.rotation.toFixed(2)}deg)`;
  }

  function extractOpaqueBoundsSync(image) {
    const w = image.naturalWidth,
      h = image.naturalHeight;
    if (!w || !h) return null;
    try {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, w, h).data;
      let minX = w,
        maxX = -1,
        minY = h,
        maxY = -1;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const a = data[(y * w + x) * 4 + 3];
          if (a > 24) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < 0) return null;
      const pad = PHYS.BBOX_PAD_PX;
      return {
        bboxW: maxX - minX + 1 + pad * 2,
        bboxH: maxY - minY + 1 + pad * 2,
      };
    } catch (e) {
      return null;
    }
  }

  function loadAndProcess(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const b = extractOpaqueBoundsSync(img);
        if (!b) return resolve(null);
        const scale = PHYS.MAX_DIM / Math.max(b.bboxW, b.bboxH);
        resolve({
          src,
          displayW: b.bboxW * scale,
          displayH: b.bboxH * scale,
          hitboxW: b.bboxW * scale,
          hitboxH: b.bboxH * scale,
          _img: img,
        });
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }
  function initPhysics(processedList) {
    const obstacleEls = [];
    OBSTACLE_SELECTORS.forEach((sel) => {
      homeSection.querySelectorAll(sel).forEach((el) => obstacleEls.push(el));
    });

    function getObstacles() {
      const r = homeSection.getBoundingClientRect();
      const ob = [];
      for (const el of obstacleEls) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        ob.push({
          x: rect.left - r.left,
          y: rect.top - r.top,
          w: rect.width,
          h: rect.height,
        });
      }
      return ob;
    }

    const floaters = [];
    const pickOrder = [...processedList].sort(() => Math.random() - 0.5);
    for (const d of pickOrder) {
      const el = document.createElement("img");
      el.src = d.src;
      el.draggable = false;
      el.alt = "";
      el.className = "floater";
      el.style.width = d.displayW + "px";
      el.style.height = d.displayH + "px";
      field.appendChild(el);
      floaters.push({
        el,
        src: d.src,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        w: d.hitboxW,
        h: d.hitboxH,
        rotation: 0,
        angVel: 0,
        dragging: false,
        lastPx: 0,
        lastPy: 0,
        velSamples: [],
      });
    }

    function getBounds() {
      const r = homeSection.getBoundingClientRect();
      return {
        w: r.width,
        h: r.height,
        bottom: r.height - PHYS.PROGRESSIVE_BLUR_MARGIN,
      };
    }

    function spawnInitial() {
      const b = getBounds();
      const pad = PHYS.HULL_MARGIN + 6;
      const placed = [];

      const homeRect = homeSection.getBoundingClientRect();
      const exclusionRects = [];
      [
        ".hero-avatar-wrapper",
        ".hero-name-lg",
        ".hero-socials-hstack",
        ".hero-scroll-btn-wrapper",
      ].forEach((sel) => {
        const el = homeSection.querySelector(sel);
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        exclusionRects.push({
          x: r.left - homeRect.left - pad,
          y: r.top - homeRect.top - pad,
          w: r.width + pad * 2,
          h: r.height + pad * 2,
        });
      });

      const overlapsUi = (cx, cy, hr) => {
        for (let i = 0; i < exclusionRects.length; i++) {
          const r = exclusionRects[i];
          if (
            cx + hr > r.x &&
            cx - hr < r.x + r.w &&
            cy + hr > r.y &&
            cy - hr < r.y + r.h
          ) {
            return true;
          }
        }
        return false;
      };

      const N = floaters.length;
      const cx = b.w / 2;
      const cy = b.bottom / 2;

      for (let i = 0; i < N; i++) {
        const f = floaters[i];
        const hr = Math.hypot(f.w, f.h) / 2;
        const baseAngle = (i / N) * Math.PI * 2 - Math.PI / 2;
        let x = 0,
          y = 0,
          ok = false;

        for (let tries = 0; tries < 24; tries++) {
          const angle = baseAngle + (Math.random() - 0.5) * 0.6;
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);
          const safeRx = (b.w / 2 - hr - pad) / Math.max(Math.abs(cosA), 1e-9);
          const safeRy =
            (b.bottom / 2 - hr - pad) / Math.max(Math.abs(sinA), 1e-9);
          const r = Math.min(safeRx, safeRy);
          const tx = cx + r * cosA;
          const ty = cy + r * sinA;
          if (
            !overlapsUi(tx, ty, hr) &&
            placed.every((p) => Math.hypot(p.x - tx, p.y - ty) > p.r + hr + 14)
          ) {
            x = tx;
            y = ty;
            ok = true;
            break;
          }
        }

        if (!ok) {
          const fallbackPts = [
            [pad + hr, pad + hr],
            [b.w - pad - hr, pad + hr],
            [b.w - pad - hr, b.bottom - pad - hr],
            [pad + hr, b.bottom - pad - hr],
            [b.w / 2, pad + hr],
            [b.w / 2, b.bottom - pad - hr],
            [pad + hr, b.bottom / 2],
            [b.w - pad - hr, b.bottom / 2],
          ];
          for (let k = 0; k < fallbackPts.length; k++) {
            const fx = fallbackPts[k][0];
            const fy = fallbackPts[k][1];
            if (
              !overlapsUi(fx, fy, hr) &&
              placed.every(
                (p) => Math.hypot(p.x - fx, p.y - fy) > p.r + hr + 14,
              )
            ) {
              x = fx;
              y = fy;
              ok = true;
              break;
            }
          }
          if (!ok) {
            const q =
              Math.floor(
                ((baseAngle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 2),
              ) % 4;
            const cornerX = q === 1 || q === 2 ? b.w - pad - hr : pad + hr;
            const cornerY = q === 0 || q === 1 ? pad + hr : b.bottom - pad - hr;
            x = cornerX;
            y = cornerY;
          }
        }

        f.x = x;
        f.y = y;

        f.vx = 0;
        f.vy = 0;
        f.rotation = (Math.random() - 0.5) * 90;

        f.angVel = (i % 2 === 0 ? 1 : -1) * PHYS.BASELINE_SPIN;
        placed.push({ x, y, r: hr });
      }
    }
    spawnInitial();
    floaters.forEach(applyTransform);

    function refineFloaterBounds(f, img) {
      const w = img.naturalWidth,
        h = img.naturalHeight;
      if (!w || !h) return;
      const host = document.createElement("div");
      host.style.cssText =
        "position:absolute;visibility:hidden;pointer-events:none;left:-99999px;top:-99999px;width:0;height:0;overflow:hidden;";
      img.style.cssText = "width:" + w + "px;height:" + h + "px;";
      host.appendChild(img);
      document.body.appendChild(host);

      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      let minX = w,
        maxX = -1,
        minY = h,
        maxY = -1;
      const stages = [80, 180, 320, 500];
      let i = 0,
        lastMs = 0;
      const sample = () => {
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, w, h).data;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const a = data[(y * w + x) * 4 + 3];
            if (a > 24) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
      };
      const tick = () => {
        if (i >= stages.length) {
          host.remove();
          if (maxX < 0) return;
          const pad = PHYS.BBOX_PAD_PX;
          const fullBboxW = maxX - minX + 1 + pad * 2;
          const fullBboxH = maxY - minY + 1 + pad * 2;
          const newScale = PHYS.MAX_DIM / Math.max(fullBboxW, fullBboxH);
          const newW = fullBboxW * newScale;
          const newH = fullBboxH * newScale;

          if (newW > f.w + 1 || newH > f.h + 1) {
            f.w = newW;
            f.h = newH;
            f.el.style.width = newW + "px";
            f.el.style.height = newH + "px";
          }
          return;
        }
        const ms = stages[i++];
        setTimeout(() => {
          sample();
          tick();
        }, ms - lastMs);
        lastMs = ms;
      };
      tick();
    }
    processedList.forEach((d) => {
      const f = floaters.find((x) => x.src === d.src);
      if (f && d._img) refineFloaterBounds(f, d._img);
    });

    function resolveObbObb(a, b) {
      const sat = satObbObb(a, b);
      if (!sat) return;
      const { overlap, axis } = sat;
      const aMov = !a.dragging;
      const bMov = !b.dragging;
      if (!aMov && !bMov) return;

      const pushDist = Math.min(overlap, 16);

      if (aMov && bMov) {
        a.x -= axis.x * pushDist * 0.5;
        a.y -= axis.y * pushDist * 0.5;
        b.x += axis.x * pushDist * 0.5;
        b.y += axis.y * pushDist * 0.5;
      } else if (aMov) {
        a.x -= axis.x * pushDist;
        a.y -= axis.y * pushDist;
      } else {
        b.x += axis.x * pushDist;
        b.y += axis.y * pushDist;
      }

      const avn = a.vx * axis.x + a.vy * axis.y;
      const bvn = b.vx * axis.x + b.vy * axis.y;
      const e = PHYS.FLOATER_E;

      if (aMov && bMov) {
        const newAvn = ((1 - e) * avn + (1 + e) * bvn) / 2;
        const newBvn = ((1 + e) * avn + (1 - e) * bvn) / 2;
        a.vx += (newAvn - avn) * axis.x;
        a.vy += (newAvn - avn) * axis.y;
        b.vx += (newBvn - bvn) * axis.x;
        b.vy += (newBvn - bvn) * axis.y;

        const aTx = a.vx - avn * axis.x;
        const aTy = a.vy - avn * axis.y;
        const bTx = b.vx - bvn * axis.x;
        const bTy = b.vy - bvn * axis.y;
        const txRel = (bTx - aTx) * -axis.y + (bTy - aTy) * axis.x;
        a.angVel += txRel * 0.04;
        b.angVel -= txRel * 0.04;
      } else if (aMov) {
        const newAvn = bvn - e * (avn - bvn);
        a.vx += (newAvn - avn) * axis.x;
        a.vy += (newAvn - avn) * axis.y;
      } else if (bMov) {
        const newBvn = avn - e * (bvn - avn);
        b.vx += (newBvn - bvn) * axis.x;
        b.vy += (newBvn - bvn) * axis.y;
      }
      clampVel(a);
      clampVel(b);
    }

    function resolveObbRect(f, rect) {
      const sat = satObbRect(f, rect);
      if (!sat) return;
      const { overlap, axis } = sat;

      f.x += axis.x * overlap;
      f.y += axis.y * overlap;
      if (f.dragging) return;

      const fvn = f.vx * axis.x + f.vy * axis.y;
      if (fvn < 0) {
        f.vx -= (1 + PHYS.OBSTACLE_E) * fvn * axis.x;
        f.vy -= (1 + PHYS.OBSTACLE_E) * fvn * axis.y;
      } else {
        f.vx *= 0.85;
        f.vy *= 0.85;
      }
      f.angVel += (Math.random() - 0.5) * 0.4;
      clampVel(f);
    }

    function resolveWalls(f) {
      const b = getBounds();
      const R = Math.hypot(f.w, f.h) / 2;
      const minX = R + PHYS.HULL_MARGIN;
      const maxX = b.w - R - PHYS.HULL_MARGIN;
      const minY = R + PHYS.HULL_MARGIN;
      const maxY = b.bottom - R - PHYS.HULL_MARGIN;

      const outLeft = f.x < minX;
      const outRight = f.x > maxX;
      const outTop = f.y < minY;
      const outBot = f.y > maxY;
      if (outLeft) f.x = minX;
      if (outRight) f.x = maxX;
      if (outTop) f.y = minY;
      if (outBot) f.y = maxY;

      if (f.dragging) return;

      if (outLeft && f.vx < 0) {
        f.vx = -f.vx * PHYS.OBSTACLE_E;
        f.angVel += (Math.random() - 0.5) * 0.5;
      } else if (outRight && f.vx > 0) {
        f.vx = -f.vx * PHYS.OBSTACLE_E;
        f.angVel += (Math.random() - 0.5) * 0.5;
      }
      if (outTop && f.vy < 0) {
        f.vy = -f.vy * PHYS.OBSTACLE_E;
        f.angVel += (Math.random() - 0.5) * 0.5;
      } else if (outBot && f.vy > 0) {
        f.vy = -f.vy * PHYS.OBSTACLE_E;
        f.angVel += (Math.random() - 0.5) * 0.5;
      }
    }

    function finalizeDrag(f, e) {
      if (!f.dragging) return;
      f.dragging = false;
      f.el.classList.remove("is-dragging");
      if (e && e.pointerId != null) {
        f.el.releasePointerCapture(e.pointerId);
      }

      const samples = f.velSamples || [];
      let flingVx = 0,
        flingVy = 0;
      if (samples.length >= 2) {
        const oldest = samples[0];
        const newest = samples[samples.length - 1];
        const dtMs = Math.max(newest.t - oldest.t, 8);

        const perFrame = 16.67 / dtMs;
        flingVx = (newest.x - oldest.x) * perFrame * PHYS.FLING_BOOST;
        flingVy = (newest.y - oldest.y) * perFrame * PHYS.FLING_BOOST;
      }
      f.vx = flingVx;
      f.vy = flingVy;
      if (samples.length) samples.length = 0;

      const sp = Math.hypot(f.vx, f.vy);
      if (sp < 1.5) {
        f.vx += (Math.random() - 0.5) * 5;
        f.vy += (Math.random() - 0.5) * 5;
        f.angVel += (Math.random() - 0.5) * 3;
      } else {
        f.angVel += f.vx * 0.04 + (Math.random() - 0.5) * 0.5;
      }

      const flingSp = Math.hypot(f.vx, f.vy);
      if (flingSp > PHYS.MAX_FLING_V) {
        const k = PHYS.MAX_FLING_V / flingSp;
        f.vx *= k;
        f.vy *= k;
      }
    }

    floaters.forEach((f) => {
      f.el.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        f.dragging = true;
        field.appendChild(f.el);
        f.el.classList.add("is-dragging");
        const r = homeSection.getBoundingClientRect();
        f.lastPx = e.clientX - r.left;
        f.lastPy = e.clientY - r.top;
        f.x = f.lastPx;
        f.y = f.lastPy;
        f.vx = f.vy = 0;
        f.velSamples = [{ t: performance.now(), x: f.lastPx, y: f.lastPy }];
        f.el.setPointerCapture(e.pointerId);
      });

      f.el.addEventListener("pointermove", (e) => {
        if (!f.dragging) return;
        const r = homeSection.getBoundingClientRect();
        const px = e.clientX - r.left;
        const py = e.clientY - r.top;
        const now = performance.now();
        f.vx = px - f.lastPx;
        f.vy = py - f.lastPy;
        f.x = px;
        f.y = py;
        f.lastPx = px;
        f.lastPy = py;

        f.velSamples.push({ t: now, x: px, y: py });
        while (
          f.velSamples.length > 1 &&
          now - f.velSamples[0].t > PHYS.FLING_BUF_MS
        ) {
          f.velSamples.shift();
        }
        const sp = Math.hypot(f.vx, f.vy);
        if (sp > 0.4) {
          f.angVel = f.vx * 0.05 + (Math.random() - 0.5) * 0.08;
        }
      });

      f.el.addEventListener("pointerup", (e) => finalizeDrag(f, e));
      f.el.addEventListener("pointercancel", (e) => finalizeDrag(f, e));
    });

    const endAnyDrag = () => floaters.forEach((f) => finalizeDrag(f));
    window.addEventListener("pointerup", endAnyDrag);
    window.addEventListener("pointercancel", endAnyDrag);

    let lastTime = performance.now();
    let rafId = null;

    function tick(now) {
      rafId = requestAnimationFrame(tick);
      const dt = Math.min((now - lastTime) / 16.67, 3);
      lastTime = now;

      const obstacles = getObstacles();

      floaters.forEach((f) => {
        if (f.dragging) return;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.rotation += f.angVel * dt;
        f.vx *= PHYS.DAMPING;
        f.vy *= PHYS.DAMPING;
        const sign = f.angVel >= 0 ? 1 : -1;
        const mag = Math.max(
          PHYS.BASELINE_SPIN,
          Math.abs(f.angVel) * 0.96 + (Math.random() - 0.5) * 0.05,
        );
        f.angVel = sign * mag;
        clampVel(f);
      });

      floaters.forEach(resolveWalls);

      floaters.forEach((f) => {
        obstacles.forEach((rect) => resolveObbRect(f, rect));
      });

      for (let i = 0; i < floaters.length; i++) {
        for (let j = i + 1; j < floaters.length; j++) {
          resolveObbObb(floaters[i], floaters[j]);
        }
      }

      floaters.forEach(applyTransform);
    }

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      } else if (!document.hidden && rafId == null) {
        lastTime = performance.now();
        rafId = requestAnimationFrame(tick);
      }
    });

    window.addEventListener("resize", () => spawnInitial());

    rafId = requestAnimationFrame(tick);
  }

  const lastfmPromise = getRecent();

  Promise.all(FLOATER_IMAGES.map(loadAndProcess)).then((processedList) => {
    const valid = processedList.filter(Boolean);
    initPhysics(valid);

    lastfmPromise.then(populateLastfm);
  });

  (function attachShine(el) {
    let cached = null;
    el.addEventListener("pointerenter", () => {
      const r = el.getBoundingClientRect();
      cached = { left: r.left, top: r.top };
    });
    el.addEventListener("pointermove", (e) => {
      if (!cached) return;
      const xPct = ((e.clientX - cached.left) / el.offsetWidth) * 100;
      const yPct = ((e.clientY - cached.top) / el.offsetHeight) * 100;
      el.style.setProperty("--shine-x", xPct.toFixed(2) + "%");
      el.style.setProperty("--shine-y", yPct.toFixed(2) + "%");
    });
    el.addEventListener("pointerleave", () => {
      cached = null;
    });
  })(lastfmWidget);

  function populateLastfm(track) {
    const widget = document.querySelector(".lastfm-widget");
    if (!widget) return;
    const titleEl = widget.querySelector(".lastfm-widget-title");
    const nameEl = widget.querySelector(".lastfm-widget-artist-name");
    const timeEl = widget.querySelector(".lastfm-widget-time");
    const coverEl = widget.querySelector(".lastfm-widget-cover");
    const shimmerEl = widget.querySelector(".lastfm-shimmer");
    if (!track) {
      if (titleEl) titleEl.textContent = "—";
      if (nameEl) nameEl.textContent = "offline";
      if (timeEl) timeEl.textContent = "";
      if (shimmerEl) shimmerEl.style.opacity = "0";
      return;
    }
    if (titleEl) titleEl.textContent = track.title;
    if (nameEl) nameEl.textContent = track.artist;
    if (coverEl && track.cover) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.className = "lastfm-widget-img";
      img.alt = track.title + " — " + track.artist;
      img.loading = "lazy";
      img.decoding = "async";
      img.onload = function () {
        if (shimmerEl && shimmerEl.parentNode) {
          shimmerEl.parentNode.removeChild(shimmerEl);
        }
        img.classList.add("is-loaded");
      };
      img.onerror = function () {
        if (shimmerEl) shimmerEl.style.opacity = "0";
      };
      img.src = track.cover;
      coverEl.appendChild(img);
    } else if (shimmerEl) {
      shimmerEl.style.opacity = "0";
    }

    if (timeEl) {
      timeEl.textContent = formatTimeAgo(track.date, track.nowPlaying);
    }

    widget.dataset.lastfmDate = track.date != null ? track.date.toString() : "";
    widget.dataset.lastfmNowplaying = track.nowPlaying ? "true" : "false";

    if (track.url) {
      widget.href = track.url;
    }

    startTimeTicker();
  }

  function formatTimeAgo(dateMs, nowPlaying) {
    if (nowPlaying) return "• Now";
    if (dateMs == null) return "";
    const diff = Date.now() - dateMs;
    if (diff < 0) return "";
    const sec = Math.floor(diff / 1000);
    if (sec < 5) return "• just now";
    if (sec < 60) return "• " + sec + "s ago";
    const min = Math.floor(sec / 60);
    if (min < 60) return "• " + min + "m ago";
    const hrs = Math.floor(min / 60);
    if (hrs < 24) return "• " + hrs + "h ago";
    const days = Math.floor(hrs / 24);
    if (days < 30) return "• " + days + "d ago";
    const weeks = Math.floor(days / 7);
    if (weeks < 8) return "• " + weeks + "w ago";
    const months = Math.floor(days / 30);
    if (months < 12) return "• " + months + "mo ago";
    const years = Math.floor(days / 365);
    return "• " + years + "y ago";
  }

  let timeTickerId = null;
  function startTimeTicker() {
    if (timeTickerId) return;
    timeTickerId = setInterval(() => {
      const widget = document.querySelector(".lastfm-widget");
      if (!widget) return;
      const timeEl = widget.querySelector(".lastfm-widget-time");
      if (!timeEl) return;
      const dateMs = parseInt(widget.dataset.lastfmDate, 10);
      const nowPlaying = widget.dataset.lastfmNowplaying === "true";
      if (!isNaN(dateMs) || nowPlaying) {
        timeEl.textContent = formatTimeAgo(
          isNaN(dateMs) ? null : dateMs,
          nowPlaying,
        );
      }
    }, 30000);
  }
}
