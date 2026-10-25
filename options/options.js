(function () {
  "use strict";

  const S = globalThis.kidclock4yt.schedule;
  const list = document.getElementById("slots");
  const empty = document.getElementById("empty");
  const status = document.getElementById("status");
  const tpl = document.getElementById("row");

  const clock = globalThis.kidclock4yt.clock.buildClock([]);
  document.getElementById("preview").appendChild(clock.el);
  setInterval(() => clock.tick(new Date()), 1000);

  function readRows() {
    return [...list.querySelectorAll(".slot")].map((li) => ({
      li,
      start: li.querySelector(".start").value,
      end: li.querySelector(".end").value,
    }));
  }

  function refresh() {
    const rows = readRows();
    for (const r of rows) {
      const s = S.toMin(r.start);
      const e = S.toMin(r.end);
      const note = r.li.querySelector(".note");
      let invalid = false;
      if (Number.isNaN(s) || Number.isNaN(e)) {
        note.textContent = "";
        invalid = r.start !== "" || r.end !== "";
      } else if (s === e) {
        note.textContent = "start = end";
        invalid = true;
      } else {
        note.textContent = e < s ? "(overnight)" : "";
      }
      r.li.classList.toggle("invalid", invalid);
    }
    empty.hidden = rows.length > 0;
    clock.setSlots(rows.map(({ start, end }) => ({ start, end })));
    clock.tick(new Date());
  }

  function addRow(slot) {
    const li = tpl.content.firstElementChild.cloneNode(true);
    li.querySelector(".start").value = (slot && slot.start) || "";
    li.querySelector(".end").value = (slot && slot.end) || "";
    li.querySelector(".remove").addEventListener("click", () => {
      li.remove();
      refresh();
    });
    li.addEventListener("input", refresh);
    list.appendChild(li);
    return li;
  }

  function setStatus(text, isError) {
    status.textContent = text;
    status.classList.toggle("error", !!isError);
  }

  document.getElementById("add").addEventListener("click", () => {
    addRow().querySelector(".start").focus();
    refresh();
    setStatus("");
  });

  document.getElementById("save").addEventListener("click", async () => {
    const rows = readRows();
    const bad = rows.filter((r) => !S.isValidSlot(r));
    if (bad.length) {
      for (const r of bad) r.li.classList.add("invalid");
      setStatus("Fix the highlighted slots: both times are required and must differ.", true);
      return;
    }
    const slots = rows
      .map(({ start, end }) => ({ start, end }))
      .sort((a, b) => S.toMin(a.start) - S.toMin(b.start));
    await browser.storage.local.set({ slots });
    list.textContent = "";
    slots.forEach(addRow);
    refresh();
    setStatus("Saved.");
  });

  browser.storage.local.get({ slots: [] }).then((r) => {
    S.normalize(r.slots).forEach(addRow);
    refresh();
  });
})();
