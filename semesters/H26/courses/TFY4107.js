// TFY4107 — Fysikk

defineCourse({
  code: "TFY4107",
  name: "Fysikk",
  color: "#E2FDF6",

  lectures: [
    { day: "Thursday",  start: "14:15", end: "16:00", type: "Main" },
    { day: "Friday",    start: "12:15", end: "14:00", type: "Main" },
    { day: "Wednesday", start: "14:15", end: "16:00", type: "Exercise" },
    { day: "Friday",    start: "14:15", end: "16:00", type: "Exercise" },
  ],

  exercises: [
    { due: "2026-08-23", name: "Øving 1",  done: true },
    { due: "2026-08-30", name: "Øving 2",  done: true },
    { due: "2026-09-06", name: "Øving 3",  done: true },
    { due: "2026-09-13", name: "Øving 4",  done: true },
    { due: "2026-09-20", name: "Øving 5",  done: true },
    { due: "2026-09-27", name: "Øving 6",  done: true },
    { due: "2026-10-04", name: "Øving 7",  done: true },
    { due: "2026-10-11", name: "Øving 8",  done: true },
    { due: "2026-10-18", name: "Øving 9",  done: false },
    { due: "2026-10-25", name: "Øving 10", done: false },
    { due: "2026-11-01", name: "Øving 11", done: false },
    { due: "2026-11-08", name: "Øving 12", done: false },
    { due: "2026-11-15", name: "Øving 13", done: false },
    { due: "2026-11-22", name: "Øving 14", done: false },
  ],

  exam: { date: "2026-11-25", time: "15:00" },

  notes: [
    "Øvingsopplegget er godkjent fra ifjor, men lurt å gjøre øvingene (dropper lab)",
  ],
});
