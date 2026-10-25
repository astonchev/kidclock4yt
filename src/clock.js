/* Analog clock face with allowed slots highlighted.
 * Gray face, white hour boundaries and digits, black hands.
 * A.M. slots: outer yellow band. P.M. slots: inner blue band. */
(function (root) {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const C = 100;
  const FACE_R = 98;
  const AM = { r: 91, w: 12, color: "#FFD400" };
  const PM = { r: 78, w: 12, color: "#2F7BFF" };
  const TICK_INNER = PM.r - PM.w / 2;
  const DIGIT_R = 58;

  function el(name, attrs, parent) {
    const node = document.createElementNS(NS, name);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  function point(r, minOfHalf) {
    const a = (minOfHalf / 720) * 2 * Math.PI;
    return [C + r * Math.sin(a), C - r * Math.cos(a)];
  }

  function drawArc(group, band, fromMin, toMin) {
    const common = { fill: "none", stroke: band.color, "stroke-width": band.w };
    if (toMin - fromMin >= 720) {
      el("circle", Object.assign({ cx: C, cy: C, r: band.r }, common), group);
      return;
    }
    const [x1, y1] = point(band.r, fromMin);
    const [x2, y2] = point(band.r, toMin);
    const large = toMin - fromMin > 360 ? 1 : 0;
    el("path", Object.assign({
      d: `M ${x1} ${y1} A ${band.r} ${band.r} 0 ${large} 1 ${x2} ${y2}`,
    }, common), group);
  }

  function hand(parent, length, width, tail) {
    return el("line", {
      x1: C, y1: C + tail, x2: C, y2: C - length,
      stroke: "#000", "stroke-width": width, "stroke-linecap": "round",
    }, parent);
  }

  function buildClock(slots) {
    const S = root.kidclock4yt.schedule;
    let current = slots || [];

    const wrap = document.createElement("div");
    wrap.className = "kidclock4yt-clock";

    const svg = el("svg", { viewBox: "0 0 200 200", class: "kidclock4yt-clock-svg", role: "img" });
    wrap.appendChild(svg);

    el("circle", { cx: C, cy: C, r: FACE_R, fill: "#808080" }, svg);
    const arcs = el("g", {}, svg);

    const ticks = el("g", { stroke: "#fff", "stroke-width": 2 }, svg);
    for (let h = 0; h < 12; h++) {
      const [x1, y1] = point(TICK_INNER, h * 60);
      const [x2, y2] = point(FACE_R, h * 60);
      el("line", { x1, y1, x2, y2 }, ticks);
    }

    const digits = el("g", {
      fill: "#fff", "font-family": "Arial, Helvetica, sans-serif", "font-size": 18,
      "font-weight": "bold", "text-anchor": "middle", "dominant-baseline": "central",
    }, svg);
    for (let h = 1; h <= 12; h++) {
      const [x, y] = point(DIGIT_R, h * 60);
      el("text", { x, y }, digits).textContent = String(h);
    }

    const hourHand = hand(svg, 38, 6, 8);
    const minuteHand = hand(svg, 56, 4, 10);
    const secondHand = hand(svg, 62, 1.5, 14);
    el("circle", { cx: C, cy: C, r: 4, fill: "#000" }, svg);

    const caption = document.createElement("div");
    caption.className = "kidclock4yt-clock-caption";
    wrap.appendChild(caption);

    function setSlots(next) {
      current = next || [];
      while (arcs.firstChild) arcs.removeChild(arcs.firstChild);
      for (const arc of S.slotsToArcs(current)) {
        drawArc(arcs, arc.half === "am" ? AM : PM, arc.fromMin, arc.toMin);
      }
    }

    function tick(date) {
      const s = date.getSeconds();
      const m = date.getMinutes() + s / 60;
      const h = (date.getHours() % 12) + m / 60;
      hourHand.setAttribute("transform", `rotate(${h * 30} ${C} ${C})`);
      minuteHand.setAttribute("transform", `rotate(${m * 6} ${C} ${C})`);
      secondHand.setAttribute("transform", `rotate(${s * 6} ${C} ${C})`);

      let text;
      if (!S.normalize(current).length) {
        text = "No time slots configured";
      } else if (S.isAllowed(date, current)) {
        text = "Watching allowed now";
      } else {
        const n = S.nextSlot(date, current);
        text = `Next: ${S.fmt(S.toMin(n.start))}–${S.fmt(S.toMin(n.end))}`;
      }
      if (caption.textContent !== text) caption.textContent = text;
    }

    setSlots(current);
    tick(new Date());
    return { el: wrap, svg, setSlots, tick };
  }

  root.kidclock4yt.clock = { buildClock };
})(globalThis);
