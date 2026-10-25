/* Replaces the m.youtube.com player with a clock outside allowed time slots. */
(function () {
  "use strict";

  const S = globalThis.kidclock4yt.schedule;
  const PLAYER_SELECTOR = "#player-container-id, .player-container, ytm-player, #player";
  const BLOCKED_ATTR = "data-kidclock4yt-blocked";

  let slots = [];
  let loaded = false;
  let blocked = true; // safe default until storage is read
  const overlays = new Map(); // container -> {overlay, clock}
  const mutedByUs = new Set();

  function computeBlocked() {
    return !S.isAllowed(new Date(), slots);
  }

  function findContainers() {
    const found = new Set(document.querySelectorAll(PLAYER_SELECTOR));
    for (const v of document.querySelectorAll("video")) {
      const c = v.closest(PLAYER_SELECTOR) || v.parentElement;
      if (c) found.add(c);
    }
    // Keep only outermost containers so nested matches don't get double overlays.
    return [...found].filter((c) => ![...found].some((o) => o !== c && o.contains(c)));
  }

  function stopVideo(v) {
    if (!v.paused) v.pause();
    if (!v.muted) {
      v.muted = true;
      mutedByUs.add(v);
    }
  }

  function stopAllVideos() {
    for (const v of document.querySelectorAll("video")) stopVideo(v);
  }

  function onPlay(e) {
    if (blocked && e.target instanceof HTMLMediaElement) stopVideo(e.target);
  }

  function ensureOverlays() {
    const now = new Date();
    const containers = findContainers();
    for (const c of containers) {
      let entry = overlays.get(c);
      if (!entry || !entry.overlay.isConnected || entry.overlay.parentNode !== c) {
        const clock = globalThis.kidclock4yt.clock.buildClock(slots);
        const overlay = document.createElement("div");
        overlay.className = "kidclock4yt-overlay";
        overlay.appendChild(clock.el);
        // Swallow taps so the hidden player underneath can't be started.
        for (const t of ["click", "touchstart", "touchend", "pointerdown", "mousedown"]) {
          overlay.addEventListener(t, (ev) => { ev.stopPropagation(); ev.preventDefault(); }, true);
        }
        c.appendChild(overlay);
        entry = { overlay, clock };
        overlays.set(c, entry);
      }
      c.setAttribute(BLOCKED_ATTR, "");
      entry.clock.tick(now);
    }
    for (const [c, entry] of overlays) {
      if (!c.isConnected || !containers.includes(c)) {
        entry.overlay.remove();
        c.removeAttribute(BLOCKED_ATTR);
        overlays.delete(c);
      }
    }
  }

  function removeOverlays() {
    for (const [c, entry] of overlays) {
      entry.overlay.remove();
      c.removeAttribute(BLOCKED_ATTR);
    }
    overlays.clear();
    for (const v of mutedByUs) if (v.isConnected) v.muted = false;
    mutedByUs.clear();
  }

  function update() {
    if (loaded) blocked = computeBlocked();
    if (!blocked) {
      if (overlays.size || mutedByUs.size) removeOverlays();
      return;
    }
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    stopAllVideos();
    if (document.body) ensureOverlays();
  }

  let pending = false;
  function scheduleUpdate() {
    if (pending || !blocked) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      update();
    });
  }

  function applySlots(next) {
    slots = S.normalize(next);
    loaded = true;
    for (const { clock } of overlays.values()) clock.setSlots(slots);
    update();
  }

  document.addEventListener("play", onPlay, true);
  document.addEventListener("playing", onPlay, true);

  browser.storage.local.get({ slots: [] }).then((r) => applySlots(r.slots));
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.slots) applySlots(changes.slots.newValue);
  });

  new MutationObserver(scheduleUpdate).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  setInterval(update, 1000);
  update();
})();
