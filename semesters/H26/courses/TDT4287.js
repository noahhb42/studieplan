// TDT4287 — Algoritmer for bioinformatikk

defineCourse({
  code: "TDT4287",
  name: "Algoritmer for bioinformatikk",
  color: "#F0E2FD",

  lectures: [
    { day: "Monday",    start: "10:15", end: "12:00", type: "Main" },
    { day: "Tuesday",   start: "08:15", end: "11:00", type: "Exercise" },
  ],

  required: null,  // exercises needed for approval, e.g. 8 (null = all mandatory ones)

  exercises: [
    { due: "2026-09-04", name: "Øving 0",  status: "todo", optional: true },
    { due: "2026-09-04", name: "Øving 1",  status: "todo", optional: true },
    { due: "2026-09-11", name: "Øving 2",  status: "todo", optional: true },
    { due: "2026-09-25", name: "Øving 3",  status: "todo", optional: true },
    { due: "2026-10-25", name: "Prosjekt", status: "done" },
    { due: "2026-10-30", name: "Øving 4",  status: "todo", optional: true },
    { due: "2026-11-13", name: "Øving 5",  status: "todo", optional: true },
  ],

  exam: { date: "2026-12-17", time: "09:00" },

  materials: [
    { title: "An Introduction to Bioinformatics Algorithms", note: "Neil C. Jones & Pavel A. Pevzner · MIT Press, 2004" },
    { title: "Algorithms on Strings, Trees, and Sequences: Computer Science and Computational Biology", note: "Dan Gusfield · Cambridge University Press, 1997" },
    { title: "Slides fra forelesninger" },
  ],

  notes: [],
});
