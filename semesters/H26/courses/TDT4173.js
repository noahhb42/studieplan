// TDT4173 — Moderne maskinlæring i praksis

defineCourse({
  code: "TDT4173",
  name: "Moderne maskinlæring i praksis",
  color: "#FDF6E2",

  lectures: [
    { day: "Thursday",  start: "08:15", end: "10:00", type: "Main" },
    { day: "Friday",    start: "14:15", end: "16:00", type: "Exercise" },
  ],

  required: null,  // exercises needed for approval, e.g. 8 (null = all mandatory ones)

  exercises: [
    { due: "2026-09-19", name: "Individuelt prosjekt", status: "done" },
  ],

  exam: { date: "2026-11-08", time: "22:00" },

  materials: [
    { title: "Machine Learning", note: "Tom M. Mitchell · McGraw-Hill, 1997" },
    { title: "Pattern Recognition and Machine Learning", note: "Christopher M. Bishop · Springer, 2006" },
    { title: "Practical Machine Learning with Python: A Problem-Solver's Guide to Building Real-World Intelligent Systems", note: "Dipanjan Sarkar, Raghav Bali & Tushar Sharma · Apress, 2017" },
    { title: "Slides fra forelesninger" },
  ],

  notes: [],
});
