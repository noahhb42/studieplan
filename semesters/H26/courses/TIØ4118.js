// TIØ4118 — Industriell økonomisk analyse

defineCourse({
  code: "TIØ4118",
  name: "Industriell økonomisk analyse",
  color: "#EAF0E2",

  lectures: [
    { day: "Wednesday", start: "09:15", end: "12:00", type: "Main" },
    { day: "Friday",    start: "10:15", end: "12:00", type: "Exercise" },
  ],

  required: 8,  // exercises needed for approval (null = all mandatory ones)

  exercises: [
    { due: "2026-08-28", name: "Øving 1",  status: "done" },
    { due: "2026-09-04", name: "Øving 2",  status: "done" },
    { due: "2026-09-18", name: "Øving 3",  status: "done" },
    { due: "2026-09-25", name: "Øving 4",  status: "todo" },
    { due: "2026-10-02", name: "Øving 5",  status: "done" },
    { due: "2026-10-09", name: "Øving 6",  status: "done" },
    { due: "2026-10-16", name: "Øving 7",  status: "done" },
    { due: "2026-10-23", name: "Øving 8",  status: "done" },
    { due: "2026-10-30", name: "Øving 9",  status: "todo" },
    { due: "2026-11-04", name: "Øving 10", status: "todo" },
  ],

  exam: { date: "2026-11-19", time: "09:00" },

  materials: [
    { title: "Microeconomics", note: "Robert S. Pindyck & Daniel L. Rubinfeld · Pearson" },
  ],

  notes: [],
});
