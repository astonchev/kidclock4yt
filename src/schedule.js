/* Pure schedule logic. Slots are {start: "HH:MM", end: "HH:MM"}, same every day.
 * Start is inclusive, end exclusive. end <= start means the slot wraps past midnight. */
(function (root) {
  "use strict";

  const DAY = 24 * 60;
  const HALF = 12 * 60;

  function toMin(hhmm) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || "").trim());
    if (!m) return NaN;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return NaN;
    return h * 60 + min;
  }

  function fmt(mins) {
    mins = ((mins % DAY) + DAY) % DAY;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  }

  function isValidSlot(slot) {
    const s = toMin(slot && slot.start);
    const e = toMin(slot && slot.end);
    return !Number.isNaN(s) && !Number.isNaN(e) && s !== e;
  }

  function normalize(slots) {
    return Array.isArray(slots) ? slots.filter(isValidSlot) : [];
  }

  // Each slot as one or two [from, to) intervals within [0, 1440).
  function intervals(slots) {
    const out = [];
    for (const slot of normalize(slots)) {
      const s = toMin(slot.start);
      const e = toMin(slot.end);
      if (e > s) {
        out.push([s, e]);
      } else {
        out.push([s, DAY]);
        if (e > 0) out.push([0, e]);
      }
    }
    return out;
  }

  function minutesOf(date) {
    return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
  }

  function isAllowed(date, slots) {
    const now = minutesOf(date);
    return intervals(slots).some(([a, b]) => now >= a && now < b);
  }

  // Split slots at noon/midnight into drawable segments: {half, fromMin, toMin},
  // where fromMin/toMin are minutes within that half (0..720).
  function slotsToArcs(slots) {
    const arcs = [];
    for (const [a, b] of intervals(slots)) {
      if (a < HALF) arcs.push({ half: "am", fromMin: a, toMin: Math.min(b, HALF) });
      if (b > HALF) arcs.push({ half: "pm", fromMin: Math.max(a, HALF) - HALF, toMin: b - HALF });
    }
    return arcs;
  }

  // Next slot (start/end strings) that begins after `date`, wrapping to tomorrow.
  function nextSlot(date, slots) {
    const valid = normalize(slots);
    if (!valid.length) return null;
    const now = minutesOf(date);
    let best = null;
    let bestDelta = Infinity;
    for (const slot of valid) {
      let delta = toMin(slot.start) - now;
      if (delta <= 0) delta += DAY;
      if (delta < bestDelta) {
        bestDelta = delta;
        best = slot;
      }
    }
    return best;
  }

  const api = { toMin, fmt, isValidSlot, normalize, isAllowed, slotsToArcs, nextSlot };
  root.kidclock4yt = Object.assign(root.kidclock4yt || {}, { schedule: api });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
