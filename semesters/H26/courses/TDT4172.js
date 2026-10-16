// TDT4172 — Introduksjon til maskinlæring

defineCourse({
  code: "TDT4172",
  name: "Introduksjon til maskinlæring",
  color: "#E2FDE9",

  lectures: [
    { day: "Wednesday", start: "12:15", end: "14:00", type: "Main" },
    { day: "Monday",    start: "08:15", end: "10:00", type: "Exercise" },
    { day: "Monday",    start: "14:15", end: "16:00", type: "Exercise" },
    { day: "Tuesday",   start: "10:15", end: "12:00", type: "Exercise" },
    { day: "Tuesday",   start: "12:15", end: "14:00", type: "Exercise" },
    { day: "Friday",    start: "14:15", end: "16:00", type: "Exercise" },
  ],

  exercises: [
    { due: "2026-09-18", name: "Prosjekt 1", done: true },
    { due: "2026-10-09", name: "Prosjekt 2", done: true },
    { due: "2026-10-23", name: "Prosjekt 3", done: false },
    { due: "2026-11-10", name: "Prosjekt 4", done: false },
  ],

  exam: { date: "2026-11-25", time: "09:00" },

  notes: [],
});
