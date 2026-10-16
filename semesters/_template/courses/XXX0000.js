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

  // How many exercises must be approved, e.g. 8 (of 12).
  // null = every mandatory exercise must be approved.
  required: null,

  // Exercises. status: "todo", "done" or "late".
  // Add `optional: true` for voluntary exercises: they're shown on the
  // course page but never count towards approval or show as overdue.
  // "late" = submitted after the deadline: handled, but it does NOT count
  // towards approval. `time` (optional) is when it's due that day;
  // without it, it's due at the end of the day.
  // You can also add, edit and mark exercises on the page
  // (when started with python3 serve.py).
  exercises: [
    { due: "2027-01-20", time: "23:59", name: "Øving 1", status: "todo" },
  ],

  // Exam date and time, or null if not known yet
  exam: { date: "2027-05-20", time: "09:00" },

  // Course material (pensum). `note` and `url` are optional;
  // `url` makes the title a link (course page, slides online, etc.).
  materials: [
    { title: "Textbook title", note: "Ch. 1–5" },
    { title: "Lecture slides", url: "https://..." },
  ],

  notes: [
    "Anything worth remembering about the course",
  ],
});
