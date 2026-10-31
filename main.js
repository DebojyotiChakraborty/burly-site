/* Burly landing page: theme, hero depth scene, scroll story, reveals, waitlist.
   Plain JavaScript, no dependencies. The scroll story keeps the reference
   site's mechanics: a sticky stage over a tall scroller, one step per
   feature, a 750 ms ease-in-out-cubic hand-off between features during which
   the phone swaps sides and the caption fades. */
(function () {
  "use strict";

  const doc = document.documentElement;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

  /* ---------------------------------------------------------------- theme */
  const THEME_KEY = "burly-site-theme";
  const themeListeners = new Set();

  function currentTheme() {
    return doc.dataset.theme === "light" ? "light" : "dark";
  }
  function applyTheme(theme, persist) {
    const changed = doc.dataset.theme !== theme;
    doc.dataset.theme = theme;
    doc.style.colorScheme = theme;
    if (persist) {
      try {
        localStorage.setItem(THEME_KEY, theme);
      } catch (e) {}
    }
    const toggle = document.querySelector(".theme");
    if (toggle) {
      toggle.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
      toggle.title = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
    }
    if (changed) themeListeners.forEach((fn) => fn(theme));
  }
  function onTheme(fn) {
    themeListeners.add(fn);
  }

  applyTheme(currentTheme(), false);
  const toggle = document.querySelector(".theme");
  if (toggle) {
    toggle.addEventListener("click", () => applyTheme(currentTheme() === "dark" ? "light" : "dark", true));
  }
  const lightQuery = window.matchMedia("(prefers-color-scheme: light)");
  lightQuery.addEventListener?.("change", () => {
    let stored = null;
    try {
      stored = localStorage.getItem(THEME_KEY);
    } catch (e) {}
    if (stored !== "light" && stored !== "dark") applyTheme(lightQuery.matches ? "light" : "dark", false);
  });

  /* every screenshot follows the theme: media/screens/<theme>/<name>.webp */
  const screenSrc = (name, theme) => `media/screens/${theme}/${name}.webp`;
  function syncScreens(theme) {
    document.querySelectorAll("[data-screen]").forEach((img) => {
      img.src = screenSrc(img.dataset.screen, theme);
    });
    document.querySelectorAll(".depth-scene .layer").forEach((layer) => {
      layer.style.backgroundImage = `url("${screenSrc("home", theme)}")`;
    });
  }
  syncScreens(currentTheme());
  onTheme(syncScreens);

  /* ----------------------------------------------------------------- menu */
  const menuBtn = document.querySelector(".menu-btn");
  const menu = document.querySelector(".menu");
  if (menuBtn && menu) {
    const setOpen = (open) => {
      menu.dataset.open = open ? "true" : "false";
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    };
    menuBtn.addEventListener("click", () => setOpen(menu.dataset.open !== "true"));
    menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setOpen(false)));
    document.addEventListener("pointerdown", (e) => {
      if (!menu.contains(e.target) && !menuBtn.contains(e.target)) setOpen(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menu.dataset.open === "true") {
        setOpen(false);
        menuBtn.focus();
      }
    });
  }

  /* -------------------------------------------------------------- reveals */
  const reveals = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window && !reduced.matches) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.12 }
    );
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("in"));
  }

  /* ----------------------------------------------------------- hero depth */
  // The home screen's cards lift off the phone as floating layers: 500 ms
  // after load, over 2.6 s. Label i lights once (K - i*0.09)/0.55 > 0.6.
  (function depthHero() {
    const hero = document.querySelector(".depth-hero");
    if (!hero) return;
    const scene = hero.querySelector(".depth-scene");
    const layers = Array.from(hero.querySelectorAll(".layer"));
    const labels = Array.from(hero.querySelectorAll(".depth-label"));
    const START = 500;
    const DURATION = 2600;
    const easeOut = (s) => 1 - Math.pow(1 - s, 3);

    // crop each layer out of the same screenshot
    layers.forEach((layer) => {
      const t = parseFloat(layer.dataset.top);
      const h = parseFloat(layer.dataset.height);
      layer.style.top = `${t * 100}%`;
      layer.style.height = `${h * 100}%`;
      layer.style.backgroundPosition = `0 ${(t / (1 - h)) * 100}%`;
    });

    const n = layers.length;
    function place(K) {
      const e = easeOut(K);
      layers.forEach((layer, i) => {
        const rank = n - i; // the top layer rises furthest
        const z = rank * 46 * e;
        const x = -rank * 7 * e;
        const y = -rank * 9 * e;
        layer.style.transform = `translate3d(${x}px, ${y}px, ${z}px)`;
      });
      const box = hero.getBoundingClientRect();
      labels.forEach((label, i) => {
        const layer = layers[i];
        if (!layer) return;
        const r = layer.getBoundingClientRect();
        label.style.left = `${r.left - box.left - 12}px`;
        label.style.top = `${r.top - box.top + r.height / 2}px`;
        label.classList.toggle("on", clamp((K - i * 0.09) / 0.55) > 0.6);
      });
    }

    let raf = 0;
    let t0 = 0;
    function frame(now) {
      if (!t0) t0 = now;
      const K = clamp((now - t0 - START) / DURATION);
      place(K);
      if (K < 1) raf = requestAnimationFrame(frame);
    }
    function start() {
      cancelAnimationFrame(raf);
      t0 = 0;
      if (reduced.matches) {
        place(1);
        return;
      }
      place(0);
      raf = requestAnimationFrame(frame);
    }

    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => place(raf ? 0 : 1));
    if (ro) ro.observe(hero);
    else window.addEventListener("resize", () => place(1));
    scene.style.visibility = "visible";
    start();
    reduced.addEventListener?.("change", start);
  })();

  /* ---------------------------------------------------------- scroll story */
  (function story() {
    const story = document.querySelector(".dstory");
    if (!story) return;
    const stage = story.querySelector(".dstage");
    const phone = story.querySelector(".dphone");
    const shots = Array.from(story.querySelectorAll(".shot"));
    const caps = Array.from(story.querySelectorAll(".dcap"));
    const dots = Array.from(story.querySelectorAll(".drail button"));
    const N = caps.length;
    story.style.setProperty("--steps", N);

    const DURATION = 750; // the hand-off between two features
    const HYST = 0.1; // how far past a step edge the scroll must go
    const REST_ANGLE = 9; // degrees the phone turns toward its caption
    const easeInOutCubic = (s) => (s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2);
    const side = (i) => (i % 2 === 0 ? 1 : -1); // even steps: phone right, caption left
    const rest = (i) => ({ from: i, to: i, start: 0, up: false, cut: false });

    const stepOf = (p, cur) =>
      p >= cur - HYST && p < cur + 1 + HYST ? cur : Math.min(N - 1, Math.max(0, Math.floor(p)));
    const frac = (tw, now) => (tw.from === tw.to ? 1 : clamp((now - tw.start) / DURATION));

    // Moves the tween toward [target]: finishes, reverses mid-flight, or
    // starts a new hand-off (cut = more than one step at once).
    function advance(tw, target, now) {
      let w = tw;
      if (w.from !== w.to) {
        const T = (now - w.start) / DURATION;
        if (T >= 1) w = rest(w.to);
        else if (Math.sign(target - w.to) === Math.sign(w.from - w.to)) {
          w = { from: w.to, to: w.from, start: now - (1 - T) * DURATION, up: !w.up, cut: false };
        }
      }
      if (w.from === w.to && target !== w.to) {
        if (reduced.matches) return rest(target);
        const dir = Math.sign(target - w.to);
        const far = Math.abs(target - w.to) > 1;
        w = { from: far ? target - dir : w.to, to: target, start: now, up: dir < 0, cut: far };
      }
      return w;
    }

    const progressRaw = () => {
      const r = story.getBoundingClientRect();
      return (-r.top / (r.height - window.innerHeight)) * N;
    };
    const progress = () => clamp(progressRaw(), 0, N);

    let step = Math.min(N - 1, Math.floor(progress()));
    let tween = rest(step);
    let raf = 0;
    let shown = -1;

    function render(now) {
      const { from, to, cut } = tween;
      const rn = frac(tween, now);
      const Mt = easeInOutCubic(rn);
      const wide = window.matchMedia("(min-width: 861px)").matches;
      const reach = wide ? Math.min(stage.clientWidth * 0.24, 290) : 0;
      const s = side(from) + (side(to) - side(from)) * Mt;
      const lift = Math.sin(Math.PI * Mt);
      phone.style.transform = `translate3d(${s * reach}px, ${-lift * 8}px, 0) scale(${1 - lift * 0.04})`;
      const inner = phone.firstElementChild;
      if (inner) inner.style.transform = `rotateY(${wide ? s * REST_ANGLE : 0}deg)`;

      // the screen swaps early in the hand-off, as the reference frames do
      const swap = from === to ? 1 : clamp((rn - 0.04) / 0.12);
      shots.forEach((img, i) => {
        img.style.opacity = i === to ? swap : i === from ? 1 - swap : 0;
      });

      const cap = from === to ? to : rn < 0.12 && !cut ? from : rn > 0.88 ? to : -1;
      caps.forEach((c, i) => {
        c.classList.toggle("on", i === cap);
        c.setAttribute("aria-hidden", i === cap ? "false" : "true");
      });
      const current = Math.round(from + (to - from) * Mt);
      if (current !== shown) {
        shown = current;
        dots.forEach((d, i) => d.setAttribute("aria-current", i === current ? "true" : "false"));
        const label = caps[current]?.querySelector(".num")?.textContent?.replace(/^\d+\s*·\s*/, "");
        if (label) phone.setAttribute("aria-label", `Burly on an iPhone: ${label.toLowerCase()}`);
      }
    }

    let snap = null; // touch snapping state
    let touching = false;
    let snapTimer = 0;
    let snapFallback = 0;

    function tick() {
      raf = 0;
      const now = performance.now();
      step = stepOf(progress(), step);
      if (snap) step = clamp(step, snap.from - 1, snap.from + 1);
      tween = advance(tween, step, now);
      render(now);
      if (tween.from !== tween.to) raf = requestAnimationFrame(tick);
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    function scrollToStep(i) {
      const top = story.getBoundingClientRect().top + window.scrollY;
      const span = story.offsetHeight - window.innerHeight;
      window.scrollTo({ top: top + (span * (i + 0.5)) / N, behavior: "instant" });
    }
    dots.forEach((d, i) => d.addEventListener("click", () => scrollToStep(i)));

    // Touch: a flick that lands between two steps settles on the next one.
    const clearSnap = () => {
      window.clearTimeout(snapTimer);
      window.clearTimeout(snapFallback);
      snap = null;
      schedule();
    };
    const settle = () => {
      if (!snap || touching) return;
      const target = Math.floor(progressRaw());
      if (Math.abs(target - snap.from) > 1) return;
      const next = snap.from + Math.sign(target - snap.from);
      if (target !== snap.from && next >= 0 && next < N) scrollToStep(next);
    };
    const armSettle = () => {
      if (!snap || touching) return;
      window.clearTimeout(snapTimer);
      snapTimer = window.setTimeout(settle, 160);
    };
    window.addEventListener(
      "touchstart",
      (e) => {
        clearSnap();
        touching = true;
        const p = progressRaw();
        snap = e.touches.length === 1 && p >= 0 && p < N ? { from: step } : null;
      },
      { passive: true }
    );
    const touchEnd = (e) => {
      touching = e.touches.length > 0;
      if (!snap || touching) return;
      armSettle();
      window.clearTimeout(snapFallback);
      snapFallback = window.setTimeout(() => {
        settle();
        clearSnap();
      }, 1500);
    };
    window.addEventListener("touchend", touchEnd, { passive: true });
    window.addEventListener("touchcancel", touchEnd, { passive: true });
    window.addEventListener("scrollend", settle);
    window.addEventListener("wheel", clearSnap, { passive: true });
    window.addEventListener("keydown", clearSnap);
    window.addEventListener("click", clearSnap, { capture: true });

    // A sideways swipe on the stage moves one feature.
    let press = null;
    stage.addEventListener("pointerdown", (e) => {
      press = e.pointerType === "mouse" || !e.isPrimary ? null : { x: e.clientX, y: e.clientY, id: e.pointerId };
    });
    stage.addEventListener("pointerup", (e) => {
      const p = press;
      press = null;
      if (!p || p.id !== e.pointerId) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      if (Math.abs(dx) < 40 || Math.abs(dx) <= 1.5 * Math.abs(dy)) return;
      const next = step + (dx < 0 ? 1 : -1);
      if (next >= 0 && next < N) scrollToStep(next);
    });
    stage.addEventListener("pointercancel", () => {
      press = null;
    });

    window.addEventListener(
      "scroll",
      () => {
        schedule();
        armSettle();
      },
      { passive: true }
    );
    window.addEventListener("resize", schedule);
    tick();
  })();

  /* ------------------------------------------------------------- waitlist */
  (function waitlist() {
    const overlay = document.getElementById("waitlist");
    if (!overlay) return;
    const panel = overlay.querySelector(".wl-panel");
    const form = overlay.querySelector("form");
    const email = overlay.querySelector("#wl-email");
    let opener = null;

    function open(source) {
      opener = document.activeElement;
      overlay.hidden = false;
      overlay.dataset.source = source || "";
      document.body.style.overflow = "hidden";
      window.setTimeout(() => email?.focus(), 50);
    }
    function close() {
      overlay.hidden = true;
      document.body.style.overflow = "";
      opener?.focus?.();
    }
    document.querySelectorAll("[data-waitlist]").forEach((btn) => {
      btn.addEventListener("click", () => open(btn.dataset.waitlist));
    });
    overlay.querySelector(".wl-x")?.addEventListener("click", close);
    overlay.addEventListener("pointerdown", (e) => {
      if (!panel.contains(e.target)) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !overlay.hidden) close();
    });
    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      const value = (email?.value || "").trim();
      if (!value || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
        email?.focus();
        email?.setAttribute("aria-invalid", "true");
        return;
      }
      email?.removeAttribute("aria-invalid");
      // No backend yet: the sheet only shows the confirmation state. Wire the
      // form to a list provider (POST this value) before launch.
      overlay.dataset.done = "true";
    });
  })();
})();
