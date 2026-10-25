const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/schedule.js");

const at = (h, m = 0, s = 0) => new Date(2026, 0, 1, h, m, s);

test("empty schedule blocks everything", () => {
  assert.equal(S.isAllowed(at(10), []), false);
  assert.equal(S.isAllowed(at(10), undefined), false);
});

test("start inclusive, end exclusive", () => {
  const slots = [{ start: "16:00", end: "17:30" }];
  assert.equal(S.isAllowed(at(15, 59, 59), slots), false);
  assert.equal(S.isAllowed(at(16, 0), slots), true);
  assert.equal(S.isAllowed(at(17, 29, 59), slots), true);
  assert.equal(S.isAllowed(at(17, 30), slots), false);
});

test("overnight slot wraps past midnight", () => {
  const slots = [{ start: "22:00", end: "01:00" }];
  assert.equal(S.isAllowed(at(21, 59), slots), false);
  assert.equal(S.isAllowed(at(23, 0), slots), true);
  assert.equal(S.isAllowed(at(0, 30), slots), true);
  assert.equal(S.isAllowed(at(1, 0), slots), false);
});

test("invalid slots are ignored", () => {
  const slots = [{ start: "10:00", end: "10:00" }, { start: "x", end: "11:00" }, { start: "25:00", end: "26:00" }];
  assert.deepEqual(S.normalize(slots), []);
  assert.equal(S.isAllowed(at(10, 30), slots), false);
});

test("slotsToArcs splits at noon", () => {
  assert.deepEqual(S.slotsToArcs([{ start: "11:00", end: "13:30" }]), [
    { half: "am", fromMin: 660, toMin: 720 },
    { half: "pm", fromMin: 0, toMin: 90 },
  ]);
});

test("slotsToArcs splits at midnight", () => {
  assert.deepEqual(S.slotsToArcs([{ start: "23:00", end: "00:30" }]), [
    { half: "pm", fromMin: 660, toMin: 720 },
    { half: "am", fromMin: 0, toMin: 30 },
  ]);
  assert.deepEqual(S.slotsToArcs([{ start: "23:00", end: "00:00" }]), [
    { half: "pm", fromMin: 660, toMin: 720 },
  ]);
});

test("nextSlot picks the soonest upcoming start, wrapping to tomorrow", () => {
  const slots = [{ start: "08:00", end: "09:00" }, { start: "16:00", end: "17:00" }];
  assert.equal(S.nextSlot(at(10), slots).start, "16:00");
  assert.equal(S.nextSlot(at(18), slots).start, "08:00");
});
