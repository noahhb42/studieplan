// TDT4120 — Algoritmer og datastrukturer

defineCourse({
  code: "TDT4120",
  name: "Algoritmer og datastrukturer",
  color: "#FDE2E2",

  lectures: [
    { day: "Friday",    start: "12:15", end: "15:00", type: "Main" },
    { day: "Wednesday", start: "10:15", end: "12:00", type: "Exercise" },
  ],

  required: 7,  // exercises needed for approval (null = all mandatory ones)

  exercises: [
    { due: "2026-09-10", name: "Øving 1",  status: "done" },
    { due: "2026-09-10", name: "Øving 2a", status: "done" },
    { due: "2026-09-10", name: "Øving 2b", status: "done" },
    { due: "2026-09-17", name: "Øving 3",  status: "done" },
    { due: "2026-09-24", name: "Øving 4",  status: "done" },
    { due: "2026-10-01", name: "Øving 5",  status: "done" },
    { due: "2026-10-08", name: "Øving 6",  status: "done" },
    { due: "2026-10-15", name: "Øving 7",  status: "done" },
    { due: "2026-10-22", name: "Øving 8",  status: "done" },
    { due: "2026-10-29", name: "Øving 9",  status: "done" },
    { due: "2026-11-05", name: "Øving 10", status: "todo" },
    { due: "2026-11-12", name: "Øving 11", status: "todo" },
    { due: "2026-11-19", name: "Øving 12", status: "todo" },
    { due: "2026-11-23", name: "Øving 13", status: "todo" },
  ],

  exam: { date: "2026-12-09", time: "15:00" },

  materials: [
    { title: "Introduction to Algorithms", note: "Cormen, Leiserson, Rivest & Stein · 4th edition · MIT Press, 2022" },
    { title: "Pensumhefte" },
  ],

  notes: [],
});
