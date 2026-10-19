// TIØ4105 — Industriell økonomisk styring

defineCourse({
  code: "TIØ4105",
  name: "Industriell økonomisk styring",
  color: "#FDE2F0",

  lectures: [
    { day: "Wednesday", start: "16:15", end: "19:00", type: "Main" },
    { day: "Tuesday",   start: "16:15", end: "18:00", type: "Exercise" },
  ],

  required: 8,  // exercises needed for approval (null = all mandatory ones)

  exercises: [
    { due: "2026-09-11", name: "Øving 1",  status: "done" },
    { due: "2026-09-18", name: "Øving 2",  status: "done" },
    { due: "2026-09-25", name: "Øving 3",  status: "late" },
    { due: "2026-10-02", name: "Øving 4",  status: "done" },
    { due: "2026-10-09", name: "Øving 5",  status: "done" },
    { due: "2026-10-23", name: "Øving 7",  status: "done" },
    { due: "2026-11-06", name: "Øving 8",  status: "todo" },
    { due: "2026-11-13", name: "Øving 9",  status: "todo" },
    { due: "2026-11-20", name: "Øving 10", status: "todo" },
    { due: "2026-11-27", name: "Øving 11", status: "todo" },
    { due: "2026-12-04", name: "Øving 12", status: "todo" },
  ],

  exam: { date: "2026-12-05", time: "09:00" },

  materials: [
    { title: "Grunnleggende økonomistyring", note: "Terje Berg · 4. utgave · Fagbokforlaget, 2025" },
    { title: "Innføring i makroøkonomi – for økonomisk-administrative studier", note: "Leiv Opstad · 3. utgave · Cappelen Damm Akademisk, 2020" },
  ],

  notes: [],
});
