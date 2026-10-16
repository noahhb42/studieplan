// TEMPLATE — copy this file, rename it to the course code (e.g. TDT4120.js),
// and add the code to the `courses` list in the semester's semester.js.
//
// Times are "HH:MM", dates are "YYYY-MM-DD".

defineCourse({
  code: "XXX0000",
  name: "Full course name",
  color: "#E2E8FD",  // pastel background colour; optional

  // Weekly lectures. type: "Main" (lecture) or "Exercise" (exercise lecture)
  lectures: [
    { day: "Monday", start: "08:15", end: "10:00", type: "Main" },
  ],

  // Mandatory exercises. `done` is the starting value;
  // ticking the box on the page is saved in the browser.
  exercises: [
    { due: "2027-01-20", name: "Øving 1", done: false },
  ],

  // Exam date and time, or null if not known yet
  exam: { date: "2027-05-20", time: "09:00" },

  notes: [
    "Anything worth remembering about the course",
  ],
});
