export function initUI() {
  (function initTypingHeader() {
    const textEl = document.getElementById("typing-text");
    if (!textEl) return;

    const initialPhrase = "Hi, My Name is Christian.";
    const prefix = "I'm a ";
    const roles = [
      "Designer.",
      "Developer.",
      "Founder.",
      "Photographer.",
      "Producer.",
    ];

    let phase = "INITIAL_TYPING";
    let roleIndex = 0;
    let charIndex = 0;

    function step() {
      if (phase === "INITIAL_TYPING") {
        textEl.textContent = initialPhrase.substring(0, charIndex + 1);
        charIndex++;
        if (charIndex === initialPhrase.length) {
          phase = "INITIAL_HOLD";
          setTimeout(step, 2400);
          return;
        }
        setTimeout(step, 80);
      } else if (phase === "INITIAL_HOLD") {
        phase = "INITIAL_DELETING";
        step();
      } else if (phase === "INITIAL_DELETING") {
        textEl.textContent = initialPhrase.substring(0, charIndex - 1);
        charIndex--;
        if (charIndex === 0) {
          phase = "PREFIX_TYPING";
          charIndex = 0;
          roleIndex = 0;
          setTimeout(step, 300);
          return;
        }
        setTimeout(step, 40);
      } else if (phase === "PREFIX_TYPING") {
        textEl.textContent = prefix.substring(0, charIndex + 1);
        charIndex++;
        if (charIndex === prefix.length) {
          phase = "ROLE_TYPING";
          charIndex = 0;
          setTimeout(step, 100);
          return;
        }
        setTimeout(step, 75);
      } else if (phase === "ROLE_TYPING") {
        const currentRole = roles[roleIndex];
        textEl.textContent = prefix + currentRole.substring(0, charIndex + 1);
        charIndex++;
        if (charIndex === currentRole.length) {
          phase = "ROLE_HOLD";
          setTimeout(step, 2000);
          return;
        }
        setTimeout(step, 80);
      } else if (phase === "ROLE_HOLD") {
        if (roleIndex === roles.length - 1) {
          phase = "FULL_RESET_DELETING";
          charIndex = (prefix + roles[roleIndex]).length;
          step();
        } else {
          phase = "ROLE_DELETING";
          step();
        }
      } else if (phase === "ROLE_DELETING") {
        const currentRole = roles[roleIndex];
        textEl.textContent = prefix + currentRole.substring(0, charIndex - 1);
        charIndex--;
        if (charIndex === 0) {
          phase = "ROLE_TYPING";
          roleIndex++;
          setTimeout(step, 250);
          return;
        }
        setTimeout(step, 45);
      } else if (phase === "FULL_RESET_DELETING") {
        const fullStr = prefix + roles[roles.length - 1];
        textEl.textContent = fullStr.substring(0, charIndex - 1);
        charIndex--;
        if (charIndex === 0) {
          phase = "INITIAL_TYPING";
          roleIndex = 0;
          charIndex = 0;
          setTimeout(step, 500);
          return;
        }
        setTimeout(step, 35);
      }
    }

    setTimeout(step, 350);
  })();

  window.scrollToSection = function (id) {
    const target = document.getElementById(id);
    if (!target) return;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    target.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  const root = document.documentElement;
  const themeBtn = document.getElementById("dock-theme-btn");

  let pendingSwapTimer = null;
  let pendingCleanupTimer = null;

  function applyTheme(t) {
    root.setAttribute("data-theme", t);
    localStorage.setItem("brocodev-theme", t);
  }

  function setTheme(t) {
    const prevT = root.getAttribute("data-theme");
    if (prevT === t) return;

    if (!themeBtn) {
      applyTheme(t);
      return;
    }

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (pendingSwapTimer) clearTimeout(pendingSwapTimer);
    if (pendingCleanupTimer) clearTimeout(pendingCleanupTimer);

    const dockIcons = themeBtn.querySelector(".dock-theme-icons");
    const fromRot = parseInt(dockIcons.dataset.flipRot || "0", 10);
    const toRot = fromRot + 180;

    if (reducedMotion) {
      applyTheme(t);
      dockIcons.dataset.flipRot = toRot.toString();
      dockIcons.style.setProperty("--flip-from", `${fromRot}deg`);
      dockIcons.style.setProperty("--flip-to", `${toRot}deg`);
      dockIcons.style.transform = `rotateY(${toRot}deg)`;
      return;
    }

    dockIcons.dataset.flipRot = toRot.toString();
    dockIcons.style.setProperty("--flip-from", `${fromRot}deg`);
    dockIcons.style.setProperty("--flip-to", `${toRot}deg`);

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

  applyTheme(localStorage.getItem("brocodev-theme") || "dark");

  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const current = root.getAttribute("data-theme");
      const next = current === "dark" ? "light" : "dark";
      setTheme(next);
    });
  }

  (function initSocialsExpand() {
    const root = document.querySelector(".socials-expand-root");
    const closeBtn = root && root.querySelector(".socials-close-btn");
    const lastfmWidget = document.querySelector(".lastfm-widget");
    if (!root) return;

    setOpen(false);

    let closeTimeout = null;

    function setOpen(open) {
      if (open) {
        if (closeTimeout) {
          clearTimeout(closeTimeout);
          closeTimeout = null;
        }
        root.classList.remove("is-closing");
        root.classList.add("is-expanded");
      } else {
        if (!root.classList.contains("is-expanded")) return;
        if (closeTimeout) return;

        const reduceMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        if (reduceMotion) {
          root.classList.remove("is-expanded");
          root.classList.remove("is-closing");
          return;
        }

        root.classList.add("is-closing");
        root.classList.remove("is-expanded");
        closeTimeout = setTimeout(() => {
          root.classList.remove("is-closing");
          closeTimeout = null;
        }, 950);
      }
      root.setAttribute("aria-expanded", open ? "true" : "false");
      root
        .querySelectorAll(".socials-close-btn, .socials-expand-btns a")
        .forEach((el) => {
          el.setAttribute("tabindex", open ? "0" : "-1");
        });
    }

    function close(e) {
      if (!root.classList.contains("is-expanded")) return;
      if (e && root.contains(e.target)) return;
      setOpen(false);
    }

    root.addEventListener("click", (e) => {
      if (closeBtn && closeBtn.contains(e.target)) {
        setOpen(false);
        return;
      }
      if (
        e.target &&
        e.target.closest &&
        e.target.closest(".socials-expand-btns")
      ) {
        return;
      }
      e.stopPropagation();
      const nowOpen = !root.classList.contains("is-expanded");
      setOpen(nowOpen);
    });

    root.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const nowOpen = !root.classList.contains("is-expanded");
        setOpen(nowOpen);
      }

      if (e.key === "Escape" && root.classList.contains("is-expanded")) {
        setOpen(false);
        root.focus();
      }
    });

    document.addEventListener("click", close, true);
  })();

  (function initCursorShine() {
    const shineTargets = document.querySelectorAll(
      ".btn-pill, .hero-social-icon-btn, .carousel-arrow, .dock-item",
    );
    shineTargets.forEach((el) => {
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
    });
  })();

  const cards = Array.from(document.querySelectorAll(".carousel-card"));
  const dots = Array.from(document.querySelectorAll(".carousel-dot"));
  const prevBtn = document.getElementById("carousel-prev");
  const nextBtn = document.getElementById("carousel-next");
  let currentIndex = 0;

  function updateCarousel(newIndex) {
    currentIndex = (newIndex + cards.length) % cards.length;
    cards.forEach((card, i) => {
      card.className = "carousel-card";
      const diff = (i - currentIndex + cards.length) % cards.length;
      if (diff === 0) {
        card.classList.add("active");
      } else if (diff === 1) {
        card.classList.add("next");
      } else if (diff === cards.length - 1) {
        card.classList.add("prev");
      } else {
        card.classList.add("hidden");
      }
    });

    dots.forEach((dot, i) => {
      dot.classList.toggle("active", i === currentIndex);
    });
  }

  if (prevBtn)
    prevBtn.addEventListener("click", () => updateCarousel(currentIndex - 1));
  if (nextBtn)
    nextBtn.addEventListener("click", () => updateCarousel(currentIndex + 1));
  dots.forEach((dot, i) =>
    dot.addEventListener("click", () => updateCarousel(i)),
  );

  let startX = 0;
  const carouselTrack = document.getElementById("carousel-track");
  if (carouselTrack) {
    carouselTrack.addEventListener("touchstart", (e) => {
      startX = e.touches[0].clientX;
    });
    carouselTrack.addEventListener("touchend", (e) => {
      const endX = e.changedTouches[0].clientX;
      if (startX - endX > 40) updateCarousel(currentIndex + 1);
      if (endX - startX > 40) updateCarousel(currentIndex - 1);
    });
  }

  function updateClock() {
    const el = document.getElementById("live-clock");
    if (!el) return;
    const now = new Date();
    const options = {
      timeZone: "America/Vancouver",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    };
    el.textContent = now.toLocaleTimeString("en-US", options);
  }
  setInterval(updateClock, 1000);
  updateClock();

  const snapContainer = document.getElementById("snap-main");
  const dockItems = document.querySelectorAll(".dock-item");
  const snapSections = document.querySelectorAll(".snap-section");

  function updateDockActive() {
    if (!snapContainer) return;
    let current = "";
    snapSections.forEach((sec) => {
      const top = sec.offsetTop - 200;
      if (snapContainer.scrollTop >= top) {
        current = sec.getAttribute("id");
      }
    });
    dockItems.forEach((btn) => {
      btn.classList.remove("is-active");
      if (btn.getAttribute("onclick")?.includes(`'${current}'`)) {
        btn.classList.add("is-active");
      }
    });
  }

  if (snapContainer) {
    snapContainer.addEventListener("scroll", updateDockActive);
    updateDockActive();
  }
}
