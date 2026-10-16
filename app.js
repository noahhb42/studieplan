// =========================================================
// Studieplan app
// ---------------------------------------------------------
// All logic lives here; the files in semesters/ are only data:
//
//   semesters/index.js                  list of semesters
//   semesters/H26/semester.js           list of courses in H26
//   semesters/H26/courses/TDT4120.js    one course
//
// The chosen semester and its courses are loaded, and one of
// these pages is drawn, chosen by the URL hash:
//
//   #overview            stats, today's lectures, course cards
//   #week                week plan: lectures + exercise lectures, with toggles
//   #deadlines           mandatory exercises due in the next 2 weeks
//   #exams               exam dates
//   #course/TDT4120      one course (exercises and lectures can be edited here)
//
// Exercise progress and edits are saved in the course files by
// serve.py. View settings (toggles, last opened semester) are
// remembered in the browser.
// =========================================================

// Filled in from semesters/index.js on startup
let semesterIds = [];

// Filled in by setActiveSemester()
let activeSemesterId = null;
let courses = [];
let courseByCode = {};
let loadProblems = [];  // course files that could not be loaded

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const CALENDAR_START_MINUTES = 7 * 60;  // 07:00
const CALENDAR_END_MINUTES = 21 * 60;   // 21:00
const DEADLINE_WINDOW_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "week", label: "Week plan" },
  { id: "deadlines", label: "Mandatory exercises" },
  { id: "exams", label: "Exam dates" },
];


// ---------------------------------------------------------
// Browser settings (view settings only)
// ---------------------------------------------------------
// Exercise progress is NOT stored here: it lives in the course
// files (see "Saving exercises" below).

const STORAGE_KEY_HIDE_COMPLETED = "studieplan.hideDone";
const STORAGE_KEY_SEMESTER = "studieplan.semester";
const STORAGE_KEY_WEEK_FILTERS = "studieplan.weekFilters";

function loadSetting(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? fallback : JSON.parse(stored);
  } catch (error) {
    return fallback;
  }
}

function saveSetting(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // Storage can be unavailable (private window etc.); the page still works.
  }
}

let hideCompleted = loadSetting(STORAGE_KEY_HIDE_COMPLETED, true);

// Week plan toggles: which lecture types to show, and which courses are hidden.
let weekFilters = Object.assign(
  { showMain: true, showExercise: true, hiddenCourses: [] },
  loadSetting(STORAGE_KEY_WEEK_FILTERS, {})
);

function saveWeekFilters() {
  saveSetting(STORAGE_KEY_WEEK_FILTERS, weekFilters);
}


// ---------------------------------------------------------
// Helpers: dates, times, colours, HTML escaping
// ---------------------------------------------------------

function escapeHtml(text) {
  const replacements = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(text).replace(/[&<>"']/g, (character) => replacements[character]);
}

// "#FDE2E2" -> hue in degrees (0–360). Only the hue is used; styles.css
// decides saturation and lightness so the colours work in dark mode too.
function hexToHue(hex) {
  const value = parseInt(hex.replace("#", ""), 16);
  const red = ((value >> 16) & 255) / 255;
  const green = ((value >> 8) & 255) / 255;
  const blue = (value & 255) / 255;

  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  if (delta === 0) {
    return 220;
  }

  let hue;
  if (max === red) {
    hue = ((green - blue) / delta) % 6;
  } else if (max === green) {
    hue = (blue - red) / delta + 2;
  } else {
    hue = (red - green) / delta + 4;
  }
  return Math.round((hue * 60 + 360) % 360);
}

function hueStyle(course) {
  return `--hue: ${course.hue}`;
}

// "12:15" -> 735 (minutes after midnight)
function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// "2026-10-18" -> Date at local midnight
function parseDate(text) {
  const [year, month, day] = text.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// Date -> "2026-10-18"
function toDateText(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function minutesSinceMidnight() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function daysUntil(dateText) {
  return Math.round((parseDate(dateText) - startOfToday()) / MS_PER_DAY);
}

function formatDate(date, options = { weekday: "short", day: "numeric", month: "short" }) {
  return date.toLocaleDateString("en-GB", options);
}

function formatShortDate(dateText) {
  return formatDate(parseDate(dateText), { day: "numeric", month: "short" });
}

function describeDaysAway(days) {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 0) return `in ${days} days`;
  return `${-days} days ago`;
}

function isoWeekNumber(date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayOfWeek = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target - yearStart) / MS_PER_DAY + 1) / 7);
}

function todayWeekdayName() {
  const names = ["Sunday", ...WEEKDAYS, "Saturday"];
  return names[new Date().getDay()];
}

function courseLink(course) {
  return `#course/${encodeURIComponent(course.code)}`;
}

function lectureTypeLabel(type) {
  return type === "Main" ? "Lecture" : "Exercise lecture";
}


// ---------------------------------------------------------
// Exercises: status, deadlines, approval
// ---------------------------------------------------------

// An exercise's status is one of:
//   "todo"  not submitted yet
//   "done"  submitted on time — counts towards approval
//   "late"  submitted after the deadline — handled, but does NOT count
function exerciseStatus(exercise) {
  if (exercise.status === "done" || exercise.status === "late") {
    return exercise.status;
  }
  return "todo";
}

// "Completed" = nothing more to do (done or late). Used for deadlines,
// overdue warnings and "hide completed".
function isCompleted(exercise) {
  return exerciseStatus(exercise) !== "todo";
}

// The exact moment an exercise is due. Exercises without a `time`
// are due at the end of the day.
function dueDateTime(exercise) {
  const date = parseDate(exercise.due);
  const [hours, minutes] = (exercise.time || "23:59").split(":").map(Number);
  date.setHours(hours, minutes, 59, 999);
  return date;
}

// True when the deadline (date + time) has passed.
function isPastDue(exercise) {
  return dueDateTime(exercise) < new Date();
}

// Sort helper: earliest deadline first
function compareByDue(a, b) {
  return dueDateTime(a) - dueDateTime(b);
}

// "Sun, 18 Oct" or "Sun, 18 Oct · 14:00"
function formatDue(exercise) {
  const date = formatDate(parseDate(exercise.due));
  return exercise.time ? `${date} · ${exercise.time}` : date;
}

// "in 3 days", "today", or — when a time is set and it's less
// than a day away — "in 5 h" / "in 40 min".
function describeDue(exercise) {
  const msLeft = dueDateTime(exercise) - new Date();
  if (exercise.time && msLeft > 0 && msLeft < MS_PER_DAY) {
    const hours = Math.floor(msLeft / MS_PER_HOUR);
    if (hours >= 1) {
      return `in ${hours} h`;
    }
    return `in ${Math.max(1, Math.round(msLeft / 60000))} min`;
  }
  return describeDaysAway(daysUntil(exercise.due));
}

// Voluntary exercises (`optional: true` in the course file) are shown on
// the course page, but never count towards approval, never show as
// overdue, and are left out of the "Mandatory exercises" page.
function isVoluntary(exercise) {
  return exercise.optional === true;
}

function mandatoryExercises(course) {
  return course.exercises.filter((exercise) => !isVoluntary(exercise));
}

// Approval progress for one course (mandatory exercises only).
//   approved      exercises done on time
//   late          exercises submitted late
//   upcomingTodo  exercises not done whose deadline hasn't passed
//   required      number needed for approval. `required: null` in the
//                 course file means every mandatory exercise must be approved.
//   stillNeeded   how many more must be approved
//   atRisk        true if there aren't enough upcoming exercises left
function approvalSummary(course) {
  let approved = 0;
  let late = 0;
  let upcomingTodo = 0;

  const mandatory = mandatoryExercises(course);

  for (const exercise of mandatory) {
    const status = exerciseStatus(exercise);
    if (status === "done") {
      approved++;
    } else if (status === "late") {
      late++;
    } else if (!isPastDue(exercise)) {
      upcomingTodo++;
    }
  }

  const total = mandatory.length;
  const required = typeof course.required === "number" ? course.required : total;
  const stillNeeded = Math.max(0, required - approved);
  const atRisk = stillNeeded > upcomingTodo;

  return { approved, late, upcomingTodo, required, stillNeeded, atRisk, total };
}


// ---------------------------------------------------------
// Saving exercises
// ---------------------------------------------------------
// The course files are the only record of exercises and their status.
// When the page is started with `python3 serve.py`, every change
// (Done/Late, edit, add, delete) sends the course's full exercise
// list to serve.py, which rewrites `exercises: [...]` in the file.
// When index.html is opened directly there is no server, so
// everything is read-only.

let canSave = false;      // set on startup by checkServer()
let saveErrorMessage = "";
let saveQueue = Promise.resolve();  // saves run one after another

// Identifies an exercise in buttons: "TFY4107|Øving 9|2026-10-18"
function exerciseId(course, exercise) {
  return `${course.code}|${exercise.name}|${exercise.due}`;
}

function findExerciseById(id) {
  for (const course of courses) {
    for (const exercise of course.exercises) {
      if (exerciseId(course, exercise) === id) {
        return { course, exercise };
      }
    }
  }
  return null;
}

// True when serve.py is running (it answers /api/ping).
async function checkServer() {
  if (location.protocol === "file:") {
    return false;
  }
  try {
    const response = await fetch("/api/ping", { cache: "no-store" });
    return response.ok;
  } catch (error) {
    return false;
  }
}

// Only the fields that belong in the course file
function cleanExercise(exercise) {
  const clean = { due: exercise.due };
  if (exercise.time) {
    clean.time = exercise.time;
  }
  clean.name = exercise.name;
  clean.status = exerciseStatus(exercise);
  if (isVoluntary(exercise)) {
    clean.optional = true;
  }
  return clean;
}

// Sends one list ("exercises" or "lectures") of a course to serve.py,
// which rewrites that list in the course file. Saves run one after
// another. If saving fails, `undo()` puts the old list back and an
// error is shown.
function saveCourseList(course, field, items, undo) {
  saveErrorMessage = "";
  render();

  saveQueue = saveQueue.then(async () => {
    try {
      const response = await fetch(`/api/${field}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          semester: activeSemesterId,
          courseFile: course.fileName,
          [field]: items,
        }),
      });
      if (!response.ok) {
        const answer = await response.json().catch(() => ({}));
        throw new Error(answer.error || `Server answered ${response.status}.`);
      }
    } catch (error) {
      undo();
      saveErrorMessage = `Could not save ${course.code}: ${error.message}`;
      render();
    }
  });
}

// Shows the new exercise list right away, then saves it.
function saveCourseExercises(course, newExercises) {
  const previousExercises = course.exercises;
  course.exercises = newExercises.slice().sort(compareByDue);
  saveCourseList(course, "exercises", course.exercises.map(cleanExercise), () => {
    course.exercises = previousExercises;
  });
}

// Lectures: main lectures first, then by weekday and start time
function compareLectures(a, b) {
  const byType = (a.type === "Main" ? 0 : 1) - (b.type === "Main" ? 0 : 1);
  const byDay = WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day);
  const byStart = timeToMinutes(a.start) - timeToMinutes(b.start);
  return byType || byDay || byStart;
}

// Only the fields that belong in the course file
function cleanLecture(lecture) {
  return { day: lecture.day, start: lecture.start, end: lecture.end, type: lecture.type };
}

// Shows the new lecture list right away, then saves it.
function saveCourseLectures(course, newLectures) {
  const previousLectures = course.lectures;
  course.lectures = newLectures.slice().sort(compareLectures);
  saveCourseList(course, "lectures", course.lectures.map(cleanLecture), () => {
    course.lectures = previousLectures;
  });
}

function setExerciseStatus(course, exercise, status) {
  const newExercises = course.exercises.map((other) =>
    other === exercise ? { ...other, status } : other
  );
  saveCourseExercises(course, newExercises);
}

// Shown next to exercise tables when saving is turned off.
function renderReadOnlyNote() {
  if (canSave) {
    return "";
  }
  return `<p class="read-only-note">
    Marking and editing is turned off because the page was opened without the server.
    Start it with <code>python3 serve.py</code> to save changes.
  </p>`;
}


// ---------------------------------------------------------
// Editing exercises (add / edit / delete)
// ---------------------------------------------------------
// While an exercise is being edited, its row turns into a small form.
//   editing = { courseCode, exerciseId }   exerciseId is null when adding

let editing = null;
let editError = "";

function startEditing(courseCode, id) {
  editing = { courseCode, exerciseId: id };
  editingLecture = null;
  editError = "";
  render();
  const firstInput = document.querySelector("[data-exercise-form] input");
  if (firstInput) {
    firstInput.focus();
  }
}

// Closes any open form (exercise or lecture).
function stopEditing() {
  editing = null;
  editingLecture = null;
  editError = "";
  render();
}

// Suggested values for a new exercise, based on the course's last one:
// "Øving 8" due 23 Oct -> "Øving 9" due 30 Oct, same time.
function suggestNewExercise(course) {
  const last = course.exercises.slice().sort(compareByDue).pop();
  if (!last) {
    return { name: "Øving 1", due: toDateText(startOfToday()), time: "" };
  }

  const match = last.name.match(/^(.*?)(\d+)$/);
  const name = match ? `${match[1]}${Number(match[2]) + 1}` : "";

  const nextDue = parseDate(last.due);
  nextDue.setDate(nextDue.getDate() + 7);

  return { name, due: toDateText(nextDue), time: last.time || "" };
}

function renderExerciseForm(course, exercise, columnCount) {
  const isNew = exercise === null;
  const values = isNew ? suggestNewExercise(course) : exercise;

  return `
    <tr class="edit-row" style="${hueStyle(course)}">
      <td colspan="${columnCount}">
        <form class="exercise-form" data-exercise-form data-course="${escapeHtml(course.code)}">
          <div class="form-title">${isNew ? `New exercise in ${escapeHtml(course.code)}` : `Edit ${escapeHtml(exercise.name)}`}</div>
          <div class="form-fields">
            <label>Name
              <input name="name" value="${escapeHtml(values.name || "")}" required>
            </label>
            <label>Due date
              <input type="date" name="due" value="${escapeHtml(values.due || "")}" required>
            </label>
            <label>Time <span class="muted">(optional)</span>
              <input type="time" name="time" value="${escapeHtml(values.time || "")}">
            </label>
          </div>
          <label class="form-checkbox">
            <input type="checkbox" name="voluntary" ${values.optional ? "checked" : ""}>
            Voluntary <span class="muted">— doesn't count towards approval</span>
          </label>
          ${editError ? `<p class="form-error">${escapeHtml(editError)}</p>` : ""}
          <div class="form-actions">
            <button type="submit" class="button primary">${isNew ? "Add" : "Save"}</button>
            <button type="button" class="button" data-edit-cancel>Cancel</button>
            ${isNew ? "" : `<button type="button" class="button danger" data-edit-delete>Delete</button>`}
          </div>
        </form>
      </td>
    </tr>`;
}

function handleExerciseFormSubmit(form) {
  const course = courseByCode[form.dataset.course];
  if (!course || !editing) {
    return;
  }

  const name = form.elements.name.value.trim();
  const due = form.elements.due.value;
  const time = form.elements.time.value;

  if (!name || !due) {
    editError = "Name and due date are required.";
    render();
    return;
  }

  const original = editing.exerciseId ? findExerciseById(editing.exerciseId).exercise : null;
  const duplicate = course.exercises.some((other) =>
    other !== original && other.name === name && other.due === due
  );
  if (duplicate) {
    editError = `${course.code} already has "${name}" due ${due}.`;
    render();
    return;
  }

  const updated = { due, name, status: original ? exerciseStatus(original) : "todo" };
  if (time) {
    updated.time = time;
  }
  if (form.elements.voluntary.checked) {
    updated.optional = true;
  }

  const newExercises = original
    ? course.exercises.map((other) => (other === original ? updated : other))
    : [...course.exercises, updated];

  editing = null;
  editError = "";
  saveCourseExercises(course, newExercises);
}

// The first click asks for confirmation, the second deletes.
function handleExerciseDelete(button) {
  if (!editing || !editing.exerciseId) {
    return;
  }
  if (!button.dataset.confirm) {
    button.dataset.confirm = "yes";
    button.textContent = "Click again to delete";
    return;
  }

  const { course, exercise } = findExerciseById(editing.exerciseId);
  editing = null;
  saveCourseExercises(course, course.exercises.filter((other) => other !== exercise));
}


// ---------------------------------------------------------
// Editing lectures (add / edit / delete)
// ---------------------------------------------------------
// Works like exercise editing, on the course page.
//   editingLecture = { courseCode, index }   index into course.lectures,
//                                            null when adding

let editingLecture = null;

function startEditingLecture(courseCode, index) {
  editingLecture = { courseCode, index };
  editing = null;
  editError = "";
  render();
  const firstInput = document.querySelector("[data-lecture-form] select");
  if (firstInput) {
    firstInput.focus();
  }
}

function renderLectureForm(course, lecture, columnCount) {
  const isNew = lecture === null;
  const values = isNew ? { day: "Monday", start: "08:15", end: "10:00", type: "Main" } : lecture;

  const dayOptions = WEEKDAYS
    .map((day) => `<option value="${day}" ${values.day === day ? "selected" : ""}>${day}</option>`)
    .join("");

  return `
    <tr class="edit-row" style="${hueStyle(course)}">
      <td colspan="${columnCount}">
        <form class="exercise-form" data-lecture-form data-course="${escapeHtml(course.code)}">
          <div class="form-title">${isNew ? `New lecture in ${escapeHtml(course.code)}` : "Edit lecture"}</div>
          <div class="form-fields">
            <label>Day
              <select name="day">${dayOptions}</select>
            </label>
            <label>Start
              <input type="time" name="start" value="${escapeHtml(values.start)}" required>
            </label>
            <label>End
              <input type="time" name="end" value="${escapeHtml(values.end)}" required>
            </label>
            <label>Type
              <select name="type">
                <option value="Main" ${values.type === "Main" ? "selected" : ""}>Lecture</option>
                <option value="Exercise" ${values.type === "Exercise" ? "selected" : ""}>Exercise lecture</option>
              </select>
            </label>
          </div>
          ${editError ? `<p class="form-error">${escapeHtml(editError)}</p>` : ""}
          <div class="form-actions">
            <button type="submit" class="button primary">${isNew ? "Add" : "Save"}</button>
            <button type="button" class="button" data-edit-cancel>Cancel</button>
            ${isNew ? "" : `<button type="button" class="button danger" data-lecture-delete>Delete</button>`}
          </div>
        </form>
      </td>
    </tr>`;
}

function handleLectureFormSubmit(form) {
  const course = courseByCode[form.dataset.course];
  if (!course || !editingLecture) {
    return;
  }

  const updated = {
    day: form.elements.day.value,
    start: form.elements.start.value,
    end: form.elements.end.value,
    type: form.elements.type.value,
  };

  if (!updated.start || !updated.end) {
    editError = "Start and end time are required.";
    render();
    return;
  }
  if (timeToMinutes(updated.end) <= timeToMinutes(updated.start)) {
    editError = "The lecture must end after it starts.";
    render();
    return;
  }

  const original = editingLecture.index === null ? null : course.lectures[editingLecture.index];
  const duplicate = course.lectures.some((other) =>
    other !== original && other.day === updated.day && other.start === updated.start &&
    other.end === updated.end && other.type === updated.type
  );
  if (duplicate) {
    editError = `${course.code} already has that lecture.`;
    render();
    return;
  }

  const newLectures = original
    ? course.lectures.map((other) => (other === original ? updated : other))
    : [...course.lectures, updated];

  editingLecture = null;
  editError = "";
  saveCourseLectures(course, newLectures);
}

// The first click asks for confirmation, the second deletes.
function handleLectureDelete(button) {
  if (!editingLecture || editingLecture.index === null) {
    return;
  }
  if (!button.dataset.confirm) {
    button.dataset.confirm = "yes";
    button.textContent = "Click again to delete";
    return;
  }

  const course = courseByCode[editingLecture.courseCode];
  const lecture = course.lectures[editingLecture.index];
  editingLecture = null;
  saveCourseLectures(course, course.lectures.filter((other) => other !== lecture));
}


// ---------------------------------------------------------
// Semesters
// ---------------------------------------------------------

// "H26" -> { season: "H", year: 2026 }
function parseSemesterId(id) {
  return { season: id[0].toUpperCase(), year: 2000 + Number(id.slice(1)) };
}

// "H26" -> "Autumn 2026", "V27" -> "Spring 2027"
function semesterLabel(id) {
  const { season, year } = parseSemesterId(id);
  return `${season === "H" ? "Autumn" : "Spring"} ${year}`;
}

// Autumn semesters start 1 August, spring semesters 1 January.
function semesterStartDate(id) {
  const { season, year } = parseSemesterId(id);
  return season === "H" ? new Date(year, 7, 1) : new Date(year, 0, 1);
}

// The latest semester in the list that has started. If none has started
// yet, the first one in the list.
function findCurrentSemesterId() {
  const today = startOfToday();
  let current = semesterIds[0];
  for (const id of semesterIds) {
    if (semesterStartDate(id) <= today) {
      current = id;
    }
  }
  return current;
}

// Which semester to open when the page loads:
// - normally the one you had open last time,
// - but when a new semester has started since then, the new current one.
function chooseSemesterOnStartup() {
  const currentId = findCurrentSemesterId();
  const saved = loadSetting(STORAGE_KEY_SEMESTER, null);

  const savedIsValid = saved && semesterIds.includes(saved.openId);
  const sameSemesterPeriod = saved && saved.currentIdWhenSaved === currentId;

  if (savedIsValid && sameSemesterPeriod) {
    return saved.openId;
  }
  return currentId;
}

function rememberOpenSemester(id) {
  saveSetting(STORAGE_KEY_SEMESTER, {
    openId: id,
    currentIdWhenSaved: findCurrentSemesterId(),
  });
}


// ---------------------------------------------------------
// Loading the data files
// ---------------------------------------------------------
// Each data file calls one of the define...() functions below.
// The data is stored under the file's URL, so loadDataFile()
// can hand back exactly what that file defined.
//
// Files are loaded with <script> tags instead of fetch() so the
// page also works when index.html is opened directly as a file.

const definitionsByFile = {};

function storeDefinition(data) {
  definitionsByFile[document.currentScript.src] = data;
}

// Called by semesters/index.js
function defineSemesterList(semesterList) {
  storeDefinition(semesterList);
}

// Called by semesters/<id>/semester.js
function defineSemester(semesterInfo) {
  storeDefinition(semesterInfo);
}

// Called by semesters/<id>/courses/<code>.js
function defineCourse(course) {
  storeDefinition(course);
}

// "semesters/H26/courses/TIØ4105.js" with each part URL-encoded
function buildPath(...parts) {
  return parts.map(encodeURIComponent).join("/");
}

// Loads one data file and resolves with what it defined.
function loadDataFile(path) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = path;

    script.onload = () => {
      if (script.src in definitionsByFile) {
        resolve(definitionsByFile[script.src]);
      } else {
        reject(new Error(`${decodeURIComponent(path)} loaded, but it doesn't call a define...() function.`));
      }
    };
    script.onerror = () => {
      reject(new Error(`Could not find ${decodeURIComponent(path)}.`));
    };

    document.head.appendChild(script);
  });
}

// Loads semester.js and every course file it lists.
// Courses that fail to load are reported in `problems` instead of
// stopping the whole semester from showing.
const loadedSemesters = {};

async function loadSemester(id) {
  if (loadedSemesters[id]) {
    return loadedSemesters[id];
  }

  const semesterInfo = await loadDataFile(buildPath("semesters", id, "semester.js"));
  const courseNames = semesterInfo.courses || [];

  const results = await Promise.allSettled(
    courseNames.map((name) => loadDataFile(buildPath("semesters", id, "courses", `${name}.js`)))
  );

  const semester = { courses: [], problems: [] };
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      const course = result.value;
      course.fileName = courseNames[index];  // needed when saving
      semester.courses.push(course);
    } else {
      semester.problems.push(result.reason.message);
    }
  });

  loadedSemesters[id] = semester;
  return semester;
}

function setActiveSemester(id, data) {
  activeSemesterId = id;
  courses = data.courses;
  loadProblems = data.problems;
  courseByCode = {};

  courses.forEach((course, index) => {
    // Courses without a colour get evenly spread hues.
    course.hue = course.color ? hexToHue(course.color) : Math.round((index * 137.5) % 360);
    course.lectures = course.lectures || [];
    course.exercises = (course.exercises || []).slice().sort(compareByDue);
    course.notes = course.notes || [];
    courseByCode[course.code] = course;
  });
}

async function openSemester(id) {
  try {
    const data = await loadSemester(id);
    setActiveSemester(id, data);
    rememberOpenSemester(id);
    editing = null;
    editingLecture = null;
    render();
  } catch (error) {
    document.getElementById("content").innerHTML =
      `<p class="empty">${escapeHtml(error.message)}</p>`;
  }
}


// ---------------------------------------------------------
// Collecting data across all courses
// ---------------------------------------------------------

function exerciseItem(course, exercise) {
  return {
    course,
    exercise,
    daysLeft: daysUntil(exercise.due),
    completed: isCompleted(exercise),
    pastDue: isPastDue(exercise),
  };
}

// Every exercise of every course, earliest deadline first.
function getAllExercises() {
  const result = [];
  for (const course of courses) {
    for (const exercise of mandatoryExercises(course)) {
      result.push(exerciseItem(course, exercise));
    }
  }
  result.sort((a, b) => compareByDue(a.exercise, b.exercise) || a.course.code.localeCompare(b.course.code));
  return result;
}

// Every lecture of every course, with start/end in minutes.
function getAllLectures() {
  const result = [];
  for (const course of courses) {
    for (const lecture of course.lectures) {
      result.push({
        course,
        ...lecture,
        startMinutes: timeToMinutes(lecture.start),
        endMinutes: timeToMinutes(lecture.end),
      });
    }
  }
  return result;
}

function anyExamDates() {
  return courses.some((course) => course.exam && course.exam.date);
}

// Exams that have not happened yet, soonest first.
function getUpcomingExams() {
  return courses
    .filter((course) => course.exam && course.exam.date)
    .map((course) => ({ course, daysLeft: daysUntil(course.exam.date) }))
    .filter((item) => item.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}


// ---------------------------------------------------------
// Small reusable pieces of HTML
// ---------------------------------------------------------

// A coloured course code. Use asLink=false when it sits inside another link.
function renderChip(course, { asLink = true, active = false } = {}) {
  const classes = `chip course-tint ${active ? "active" : ""}`;
  const inner = `<span class="chip-dot"></span>${escapeHtml(course.code)}`;
  if (!asLink) {
    return `<span class="${classes}" style="${hueStyle(course)}">${inner}</span>`;
  }
  return `<a class="${classes}" style="${hueStyle(course)}" href="${courseLink(course)}">${inner}</a>`;
}

// The "Done" / "Late" buttons for one exercise, plus an edit button.
// Pressing the active button again sets the exercise back to "todo".
function renderStatusButtons(course, exercise) {
  const status = exerciseStatus(exercise);
  const id = escapeHtml(exerciseId(course, exercise));
  const disabled = canSave ? "" : "disabled";

  const button = (value, label, tooltip) => `
    <button type="button"
            class="status-button ${value} ${status === value ? "active" : ""}"
            data-exercise-id="${id}" data-set-status="${value}"
            aria-pressed="${status === value}" title="${tooltip}" ${disabled}>${label}</button>`;

  const editButton = canSave
    ? `<button type="button" class="edit-button" data-edit-exercise="${id}"
               data-course="${escapeHtml(course.code)}" title="Edit or delete" aria-label="Edit">✎</button>`
    : "";

  return `
    <div class="status-buttons" role="group" aria-label="Status">
      ${button("done", "Done", "Submitted on time (counts towards approval)")}
      ${button("late", "Late", "Submitted late (does not count towards approval)")}
    </div>
    ${editButton}`;
}

// One row in an exercise table (or its edit form, while being edited).
function renderExerciseRow(item, showCourseColumn) {
  const { course, exercise, daysLeft, completed, pastDue } = item;
  const columnCount = showCourseColumn ? 4 : 3;

  if (editing && editing.exerciseId === exerciseId(course, exercise)) {
    return renderExerciseForm(course, exercise, columnCount);
  }

  const status = exerciseStatus(exercise);

  const voluntary = isVoluntary(exercise);

  let urgencyClass = "";
  if (!completed && !voluntary && pastDue) {
    urgencyClass = "overdue";
  } else if (!completed && !voluntary && daysLeft <= 3) {
    urgencyClass = "soon";
  }

  const courseCell = showCourseColumn ? `<td>${renderChip(course)}</td>` : "";
  const lateTag = status === "late" ? `<span class="late-tag">submitted late</span>` : "";
  const voluntaryTag = voluntary ? `<span class="voluntary-tag">voluntary</span>` : "";

  return `
    <tr class="exercise-row ${completed ? "completed" : ""} ${voluntary ? "voluntary" : ""} ${status}" style="${hueStyle(course)}">
      ${courseCell}
      <td><span class="exercise-name">${escapeHtml(exercise.name)}</span>${lateTag}${voluntaryTag}</td>
      <td class="tabular">
        ${formatDue(exercise)}
        <span class="relative-date ${urgencyClass}">${describeDue(exercise)}</span>
      </td>
      <td class="status-cell">${renderStatusButtons(course, exercise)}</td>
    </tr>`;
}

// One line under a course's exercise heading, e.g.
// "6 of 8 approved · 1 late · 2 more needed, 5 left"
function renderApprovalLine(course) {
  const summary = approvalSummary(course);
  if (summary.total === 0) {
    return "";
  }

  const lateText = summary.late > 0 ? ` · ${summary.late} late` : "";
  const allText = typeof course.required === "number" ? "" : ` <span class="muted">(all required)</span>`;

  let status;
  if (summary.stillNeeded === 0) {
    status = `<span class="approval-ok">Approved ✓</span>`;
  } else if (summary.atRisk) {
    status = `<span class="approval-risk">${summary.stillNeeded} more needed, but only ${summary.upcomingTodo} left</span>`;
  } else {
    status = `${summary.stillNeeded} more needed, ${summary.upcomingTodo} left`;
  }

  // "8 approved (7 required)" once the requirement is met, otherwise "6 of 8 approved"
  const countText = summary.stillNeeded === 0 && summary.approved > summary.required
    ? `<strong>${summary.approved}</strong> approved <span class="muted">(${summary.required} required)</span>`
    : `<strong>${summary.approved} of ${summary.required}</strong> approved${allText}`;

  return `<p class="approval-line">
    ${countText}${lateText} · ${status}
  </p>`;
}


// ---------------------------------------------------------
// Weekly calendar
// ---------------------------------------------------------

// Lectures that overlap in time are placed side by side.
// Sets lecture.column (0, 1, ...) and lecture.columnCount on each lecture.
function assignColumns(lecturesOfDay) {
  let group = [];          // lectures that (transitively) overlap each other
  let groupEnd = -1;       // latest end time in the current group
  let columnEnds = [];     // end time of the last lecture placed in each column

  function finishGroup() {
    for (const lecture of group) {
      lecture.columnCount = columnEnds.length;
    }
    group = [];
    columnEnds = [];
    groupEnd = -1;
  }

  for (const lecture of lecturesOfDay) {
    if (lecture.startMinutes >= groupEnd) {
      finishGroup();
    }

    let column = columnEnds.findIndex((end) => end <= lecture.startMinutes);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(0);
    }

    columnEnds[column] = lecture.endMinutes;
    lecture.column = column;
    group.push(lecture);
    groupEnd = Math.max(groupEnd, lecture.endMinutes);
  }
  finishGroup();
}

function renderCalendarEvent(lecture) {
  const topHours = (lecture.startMinutes - CALENDAR_START_MINUTES) / 60;
  const durationHours = (lecture.endMinutes - lecture.startMinutes) / 60;
  const { column, columnCount, course } = lecture;
  const isExercise = lecture.type !== "Main";

  const position = [
    `top: calc(${topHours} * var(--hour-height) + 1px)`,
    `height: calc(${durationHours} * var(--hour-height) - 2px)`,
    `left: calc(${column} / ${columnCount} * 100% + 3px)`,
    `width: calc(100% / ${columnCount} - 6px)`,
  ].join("; ");

  // Only show extra text when the block has room for it.
  const roomy = durationHours >= 1.6 && columnCount < 3;
  const tooltip = `${course.code} ${course.name} · ${lectureTypeLabel(lecture.type)} · ${lecture.start}–${lecture.end}`;

  return `
    <a class="calendar-event course-tint ${isExercise ? "exercise" : "main"} ${columnCount >= 3 ? "narrow" : ""}" href="${courseLink(course)}"
       title="${escapeHtml(tooltip)}" style="${hueStyle(course)}; ${position}">
      <span class="calendar-event-code">${escapeHtml(course.code)}</span>
      <span class="tabular">${lecture.start}–${lecture.end}</span>
      ${roomy ? `<div class="calendar-event-name">${isExercise ? "Exercise lecture" : escapeHtml(course.name)}</div>` : ""}
    </a>`;
}

function renderCalendar(lectures) {
  const today = todayWeekdayName();
  const nowMinutes = minutesSinceMidnight();
  const hourCount = (CALENDAR_END_MINUTES - CALENDAR_START_MINUTES) / 60;
  const columnHeight = `height: calc(${hourCount} * var(--hour-height))`;

  // Header row: empty corner + weekday names
  let html = `<div></div>`;
  for (const day of WEEKDAYS) {
    html += `<div class="calendar-day-name ${day === today ? "today" : ""}">${day}</div>`;
  }

  // Hour labels down the left side
  html += `<div class="calendar-hours" style="${columnHeight}">`;
  for (let hour = 0; hour <= hourCount; hour++) {
    const label = String(CALENDAR_START_MINUTES / 60 + hour).padStart(2, "0") + ":00";
    html += `<div class="calendar-hour-label" style="top: calc(${hour} * var(--hour-height))">${label}</div>`;
  }
  html += `</div>`;

  // One column per weekday
  for (const day of WEEKDAYS) {
    const lecturesOfDay = lectures
      .filter((lecture) => lecture.day === day)
      .sort((a, b) => a.startMinutes - b.startMinutes || b.endMinutes - a.endMinutes);
    assignColumns(lecturesOfDay);

    html += `<div class="calendar-day ${day === today ? "today" : ""}" style="${columnHeight}">`;
    for (const lecture of lecturesOfDay) {
      html += renderCalendarEvent(lecture);
    }

    const nowIsVisible = nowMinutes >= CALENDAR_START_MINUTES && nowMinutes <= CALENDAR_END_MINUTES;
    if (day === today && nowIsVisible) {
      const nowHours = (nowMinutes - CALENDAR_START_MINUTES) / 60;
      html += `<div class="current-time-line" style="top: calc(${nowHours} * var(--hour-height))"></div>`;
    }
    html += `</div>`;
  }

  return `
    <div class="calendar-scroll panel">
      <div class="calendar">${html}</div>
    </div>`;
}


// ---------------------------------------------------------
// Pages
// ---------------------------------------------------------

function renderOverviewPage() {
  const exercises = getAllExercises();
  const openExercises = exercises.filter((item) => !item.completed && !item.pastDue);
  const overdueCount = exercises.filter((item) => !item.completed && item.pastDue).length;
  const nextDeadline = openExercises[0];
  const nextExam = getUpcomingExams()[0];

  // --- Stats row ---
  const nextDeadlineHtml = nextDeadline
    ? `<div class="stat-value">${escapeHtml(nextDeadline.course.code)} · ${escapeHtml(nextDeadline.exercise.name)}</div>
       <div class="stat-detail">${formatDue(nextDeadline.exercise)} · ${describeDue(nextDeadline.exercise)}</div>`
    : `<div class="stat-value">Nothing due</div>`;

  const nextExamHtml = nextExam
    ? `<div class="stat-value">${escapeHtml(nextExam.course.code)} · ${formatShortDate(nextExam.course.exam.date)}</div>
       <div class="stat-detail">${describeDaysAway(nextExam.daysLeft)} · ${escapeHtml(nextExam.course.exam.time || "")}</div>`
    : `<div class="stat-value">${anyExamDates() ? "No exams left" : "No exam dates yet"}</div>`;

  const overdueHtml = overdueCount > 0
    ? `<span class="relative-date overdue" style="margin: 0">${overdueCount} overdue, not marked</span>`
    : "none overdue";

  let html = `
    <div class="stats">
      <div class="panel stat">
        <div class="stat-label">Next deadline</div>
        ${nextDeadlineHtml}
      </div>
      <div class="panel stat">
        <div class="stat-label">Next exam</div>
        ${nextExamHtml}
      </div>
      <div class="panel stat">
        <div class="stat-label">Exercises left</div>
        <div class="stat-value">${openExercises.length} upcoming</div>
        <div class="stat-detail">${overdueHtml}</div>
      </div>
    </div>`;

  // --- Today's lectures (or Monday's, at the weekend) ---
  const today = todayWeekdayName();
  const isWeekday = WEEKDAYS.includes(today);
  const dayToShow = isWeekday ? today : "Monday";
  const nowMinutes = minutesSinceMidnight();

  const lecturesToday = getAllLectures()
    .filter((lecture) => lecture.day === dayToShow)
    .sort((a, b) => a.startMinutes - b.startMinutes);

  html += `<h3 class="section-title">${isWeekday ? "Today" : "Next Monday"}</h3>`;
  html += `<div class="panel today-list">`;
  if (lecturesToday.length === 0) {
    html += `<div class="empty">No lectures.</div>`;
  }
  for (const lecture of lecturesToday) {
    const finished = isWeekday && lecture.endMinutes <= nowMinutes;
    const live = isWeekday && lecture.startMinutes <= nowMinutes && nowMinutes < lecture.endMinutes;

    // While a lecture is on: a thin bar along the bottom showing
    // how far into the lecture we are (the green colour comes from CSS).
    let liveHtml = "";
    if (live) {
      const progress = ((nowMinutes - lecture.startMinutes) / (lecture.endMinutes - lecture.startMinutes)) * 100;
      liveHtml = `<span class="live-progress" style="width: ${progress}%"></span>`;
    }

    const classes = ["today-item", finished ? "finished" : "", live ? "live" : ""].join(" ");
    html += `
      <a class="${classes}" href="${courseLink(lecture.course)}">
        <span class="today-time">${lecture.start}–${lecture.end}</span>
        ${renderChip(lecture.course, { asLink: false })}
        <span class="today-course-name">${escapeHtml(lecture.course.name)}</span>
        ${liveHtml}
        <span class="today-type">${lectureTypeLabel(lecture.type)}</span>
      </a>`;
  }
  html += `</div>`;

  // --- One card per course ---
  html += `<h3 class="section-title">Courses</h3><div class="course-cards">`;
  for (const course of courses) {
    html += renderCourseCard(course);
  }
  html += `</div>`;

  return html;
}

function renderCourseCard(course) {
  const summary = approvalSummary(course);

  let approvalText = course.exercises.length > 0 ? "None mandatory" : "None added";
  let progressPercent = 0;
  if (summary.total > 0) {
    const lateText = summary.late > 0 ? ` <span class="muted">(+${summary.late} late)</span>` : "";
    if (summary.stillNeeded === 0) {
      approvalText = `<span class="approval-ok">${Math.min(summary.approved, summary.required)} / ${summary.required} ✓</span>${lateText}`;
    } else {
      approvalText = `<span class="${summary.atRisk ? "approval-risk" : ""}">${summary.approved} / ${summary.required}</span>${lateText}`;
    }
    progressPercent = summary.required > 0 ? Math.min(100, (summary.approved / summary.required) * 100) : 100;
  }

  const nextExercise = mandatoryExercises(course).find((exercise) => !isCompleted(exercise) && !isPastDue(exercise));
  const nextDueText = nextExercise
    ? `${escapeHtml(nextExercise.name)} · ${formatShortDate(nextExercise.due)}`
    : "—";

  let examText = "—";
  if (course.exam && course.exam.date) {
    examText = `${formatShortDate(course.exam.date)} ${escapeHtml(course.exam.time || "")}
      <span class="muted">(${describeDaysAway(daysUntil(course.exam.date))})</span>`;
  }

  return `
    <a class="panel course-card" style="${hueStyle(course)}" href="${courseLink(course)}">
      <div class="course-card-code">${escapeHtml(course.code)}</div>
      <div class="course-card-name">${escapeHtml(course.name)}</div>
      <div class="info-row"><span>Approved</span><span class="tabular">${approvalText}</span></div>
      <div class="progress-bar"><div class="progress-bar-fill" style="width: ${progressPercent}%"></div></div>
      <div class="info-row"><span>Next due</span><span>${nextDueText}</span></div>
      <div class="info-row"><span>Exam</span><span>${examText}</span></div>
    </a>`;
}

function renderWeekPage() {
  const hidden = new Set(weekFilters.hiddenCourses);

  const lectures = getAllLectures().filter((lecture) => {
    if (hidden.has(lecture.course.code)) return false;
    if (lecture.type === "Main") return weekFilters.showMain;
    return weekFilters.showExercise;
  });

  const typeToggle = (key, label, className) => `
    <button type="button" class="toggle ${className} ${weekFilters[key] ? "on" : ""}"
            data-toggle-type="${key}" aria-pressed="${weekFilters[key]}">
      <span class="toggle-swatch"></span>${label}
    </button>`;

  const courseToggles = courses.map((course) => {
    const on = !hidden.has(course.code);
    return `
      <button type="button" class="chip course-tint course-toggle ${on ? "" : "off"}" style="${hueStyle(course)}"
              data-toggle-course="${escapeHtml(course.code)}" aria-pressed="${on}" title="${escapeHtml(course.name)}">
        <span class="chip-dot"></span>${escapeHtml(course.code)}
      </button>`;
  }).join("");

  const showAll = hidden.size > 0
    ? `<button type="button" class="link-button" data-show-all-courses>Show all</button>`
    : "";

  return `
    <h2>Week plan</h2>
    <p class="lede">Lectures and exercise lectures together. Overlapping ones sit side by side. Click a block to open the course.</p>
    <div class="week-toggles">
      <div class="toggle-row">
        ${typeToggle("showMain", "Lectures", "type-main")}
        ${typeToggle("showExercise", "Exercise lectures", "type-exercise")}
      </div>
      <div class="toggle-row">${courseToggles}${showAll}</div>
    </div>
    ${courses.length > 0 && lectures.length === 0 && getAllLectures().length > 0
      ? `<p class="empty">Everything is toggled off.</p>` : ""}
    ${renderCalendar(lectures)}`;
}

function renderDeadlinesPage() {
  const exercises = getAllExercises();

  // Due within the window. Unfinished exercises whose deadline already
  // passed today go to the "past due" list instead.
  const dueSoon = exercises.filter((item) => {
    const inWindow = item.daysLeft >= 0 && item.daysLeft <= DEADLINE_WINDOW_DAYS;
    const missed = item.pastDue && !item.completed;
    const hidden = hideCompleted && item.completed;
    return inWindow && !missed && !hidden;
  });

  const overdue = exercises.filter((item) => item.pastDue && !item.completed);

  const windowEnd = new Date(startOfToday().getTime() + DEADLINE_WINDOW_DAYS * MS_PER_DAY);

  let rows = dueSoon.map((item) => renderExerciseRow(item, true)).join("");
  if (dueSoon.length === 0) {
    rows = `<tr><td colspan="4" class="empty">Nothing due in the next two weeks.</td></tr>`;
  }

  let html = `
    <h2>Mandatory exercises</h2>
    <p class="lede">
      Due in the next 2 weeks (to ${formatDate(windowEnd)}).
      Press <em>Done</em> or <em>Late</em> to save it in the course file —
      late submissions don't count towards approval. ✎ edits an exercise.
    </p>
    ${renderReadOnlyNote()}
    <div class="toolbar">
      <label>
        <input type="checkbox" id="hide-completed" ${hideCompleted ? "checked" : ""}>
        Hide completed
      </label>
    </div>
    <div class="panel">
      <table>
        <thead>
          <tr><th>Course</th><th>Exercise</th><th>Due</th><th>Status</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  if (overdue.length > 0) {
    // Keep the list open while one of its exercises is being edited.
    const editingInside = editing && overdue.some((item) => editing.exerciseId === exerciseId(item.course, item.exercise));
    html += `
      <details ${editingInside ? "open" : ""}>
        <summary>${overdue.length} past due and not marked</summary>
        <div class="panel">
          <table>
            <tbody>${overdue.map((item) => renderExerciseRow(item, true)).join("")}</tbody>
          </table>
        </div>
      </details>`;
  }

  return html;
}

function renderExamsPage() {
  const exams = courses
    .filter((course) => course.exam && course.exam.date)
    .map((course) => ({ course, daysLeft: daysUntil(course.exam.date) }))
    .sort((a, b) => {
      const byDate = parseDate(a.course.exam.date) - parseDate(b.course.exam.date);
      const byTime = (a.course.exam.time || "").localeCompare(b.course.exam.time || "");
      return byDate || byTime;
    });

  let html = `
    <h2>Exam dates</h2>
    <p class="lede">Sorted by date.</p>
    <div class="exam-cards">`;

  for (const { course, daysLeft } of exams) {
    const isPast = daysLeft < 0;
    const number = isPast ? "✓" : daysLeft;
    const unit = isPast ? "done" : daysLeft === 1 ? "day" : "days";
    const fullDate = formatDate(parseDate(course.exam.date), { weekday: "long", day: "numeric", month: "long" });

    html += `
      <a class="panel exam-card ${isPast ? "past" : ""}" style="${hueStyle(course)}" href="${courseLink(course)}">
        <div class="exam-countdown">
          <span class="exam-countdown-number">${number}</span>
          <span class="exam-countdown-unit">${unit}</span>
        </div>
        <div>
          <div class="exam-code">${escapeHtml(course.code)}</div>
          <div class="exam-name">${escapeHtml(course.name)}</div>
          <div class="exam-when">${fullDate} · ${escapeHtml(course.exam.time || "")}</div>
        </div>
      </a>`;
  }

  html += `</div>`;

  if (exams.length === 0) {
    html += `<div class="panel empty">No exam dates added yet.</div>`;
  }
  return html;
}

function renderCoursePage(courseCode) {
  const course = courseByCode[courseCode];
  if (!course) {
    return `<p class="empty">Unknown course.</p>`;
  }

  // Lectures, sorted (main lectures first). `index` points into
  // course.lectures so the edit form knows which one to change.
  const lectureColumns = canSave ? 4 : 3;
  const editingLectureHere = editingLecture && editingLecture.courseCode === course.code;
  const lectures = course.lectures
    .map((lecture, index) => ({ lecture, index }))
    .sort((a, b) => compareLectures(a.lecture, b.lecture));

  let lectureRows = lectures.map(({ lecture, index }) => {
    if (editingLectureHere && editingLecture.index === index) {
      return renderLectureForm(course, lecture, lectureColumns);
    }
    const editCell = canSave
      ? `<td class="status-cell"><button type="button" class="edit-button" data-edit-lecture="${index}"
           data-course="${escapeHtml(course.code)}" title="Edit or delete" aria-label="Edit">✎</button></td>`
      : "";
    return `
    <tr>
      <td>${lecture.day}</td>
      <td class="tabular">${lecture.start}–${lecture.end}</td>
      <td>${lectureTypeLabel(lecture.type)}</td>
      ${editCell}
    </tr>`;
  }).join("");

  const addingLectureHere = editingLectureHere && editingLecture.index === null;
  if (lectures.length === 0 && !addingLectureHere) {
    lectureRows = `<tr><td colspan="${lectureColumns}" class="empty">No lectures.</td></tr>`;
  }
  if (addingLectureHere) {
    lectureRows += renderLectureForm(course, null, lectureColumns);
  }

  const addLectureButton = canSave && !addingLectureHere
    ? `<button type="button" class="button add-button" data-add-lecture="${escapeHtml(course.code)}">+ Add lecture</button>`
    : "";

  // Exercises (already sorted by deadline), plus the "add" form when adding
  const exercises = course.exercises.map((exercise) => exerciseItem(course, exercise));

  let exerciseRows = exercises.map((item) => renderExerciseRow(item, false)).join("");
  const addingHere = editing && editing.exerciseId === null && editing.courseCode === course.code;
  if (exercises.length === 0 && !addingHere) {
    exerciseRows = `<tr><td colspan="3" class="empty">None yet.</td></tr>`;
  }
  if (addingHere) {
    exerciseRows += renderExerciseForm(course, null, 3);
  }

  const addButton = canSave && !addingHere
    ? `<button type="button" class="button add-button" data-add-exercise="${escapeHtml(course.code)}">+ Add exercise</button>`
    : "";

  // Exam
  let examHtml = `<div class="stat-detail">Not set</div>`;
  if (course.exam && course.exam.date) {
    const fullDate = formatDate(parseDate(course.exam.date), {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    examHtml = `
      <div class="stat-value">${fullDate} · ${escapeHtml(course.exam.time || "")}</div>
      <div class="stat-detail">${describeDaysAway(daysUntil(course.exam.date))}</div>`;
  }

  // Course material: title (a link if it has a url) and an optional note
  const materials = course.materials || [];
  let materialItems = materials.map((item) => {
    const safeUrl = item.url && /^https?:\/\//.test(item.url) ? item.url : null;
    const title = safeUrl
      ? `<a class="material-link" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener">${escapeHtml(item.title)} ↗</a>`
      : `<span class="material-title">${escapeHtml(item.title)}</span>`;
    const note = item.note ? `<span class="material-note">${escapeHtml(item.note)}</span>` : "";
    return `<li>${title}${note}</li>`;
  }).join("");
  if (materials.length === 0) {
    materialItems = `<li class="muted">None listed yet.</li>`;
  }
  const materialsHtml = `
    <h3 class="section-title">Course material</h3>
    <div class="panel"><ul class="materials">${materialItems}</ul></div>`;

  // Notes
  let notesHtml = "";
  if (course.notes && course.notes.length > 0) {
    const items = course.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("");
    notesHtml = `
      <h3 class="section-title">Notes</h3>
      <div class="panel"><ul class="notes">${items}</ul></div>`;
  }

  return `
    <div class="course-header course-tint" style="${hueStyle(course)}">
      <h2>${escapeHtml(course.code)}</h2>
      <p>${escapeHtml(course.name)}</p>
    </div>

    <div class="two-columns">
      <div>
        <h3 class="section-title">Lectures</h3>
        <div class="panel">
          <table>
            <thead><tr><th>Day</th><th>Time</th><th>Type</th>${canSave ? "<th></th>" : ""}</tr></thead>
            <tbody>${lectureRows}</tbody>
          </table>
        </div>
        ${addLectureButton}

        <h3 class="section-title">Exam</h3>
        <div class="panel stat">${examHtml}</div>

        ${materialsHtml}

        ${notesHtml}
      </div>

      <div>
        <h3 class="section-title">${course.exercises.some(isVoluntary) ? "Exercises" : "Mandatory exercises"}</h3>
        ${renderApprovalLine(course)}
        ${renderReadOnlyNote()}
        <div class="panel">
          <table>
            <thead><tr><th>Exercise</th><th>Due</th><th>Status</th></tr></thead>
            <tbody>${exerciseRows}</tbody>
          </table>
        </div>
        ${addButton}
      </div>
    </div>`;
}

const PAGES = {
  overview: renderOverviewPage,
  week: renderWeekPage,
  deadlines: renderDeadlinesPage,
  exams: renderExamsPage,
  course: renderCoursePage,
};

// Old addresses that now point to the week plan
const PAGE_ALIASES = { main: "week", exercise: "week" };


// ---------------------------------------------------------
// Drawing the page
// ---------------------------------------------------------

// "#course/TDT4120" -> { page: "course", argument: "TDT4120" }
function readRoute() {
  const hash = decodeURIComponent(location.hash.slice(1)) || "overview";
  let [page, argument] = hash.split("/");
  page = PAGE_ALIASES[page] || page;

  // Unknown page, or a course that isn't in this semester -> overview
  if (!(page in PAGES) || (page === "course" && !courseByCode[argument])) {
    return { page: "overview", argument: undefined };
  }
  return { page, argument };
}

function renderHeader() {
  const now = new Date();
  const fullDate = formatDate(now, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  document.getElementById("semester").textContent = activeSemesterId || "";
  document.getElementById("today").textContent = `${fullDate} · Week ${isoWeekNumber(now)}`;
  renderSemesterSwitcher();
}

// One button per semester. The current semester gets a small "now" dot.
function renderSemesterSwitcher() {
  const currentId = findCurrentSemesterId();

  document.getElementById("semester-switcher").innerHTML = semesterIds
    .map((id) => {
      const active = id === activeSemesterId ? "active" : "";
      const nowDot = id === currentId ? `<span class="now-dot" title="Current semester"></span>` : "";
      return `
        <button type="button" class="semester-button ${active}" data-semester="${escapeHtml(id)}"
                title="${semesterLabel(id)}">
          ${escapeHtml(id)}${nowDot}
        </button>`;
    })
    .join("");
}

function renderNavigation(route) {
  document.getElementById("tabs").innerHTML = TABS
    .map((tab) => {
      const active = tab.id === route.page ? "active" : "";
      return `<a class="tab ${active}" href="#${tab.id}">${tab.label}</a>`;
    })
    .join("");

  document.getElementById("course-links").innerHTML = courses
    .map((course) => {
      const active = route.page === "course" && route.argument === course.code;
      return renderChip(course, { active });
    })
    .join("");
}

// Shows warnings: course files that couldn't be loaded, and a failed save.
function renderLoadProblems() {
  let html = "";

  if (loadProblems.length > 0) {
    const items = loadProblems.map((message) => `<li>${escapeHtml(message)}</li>`).join("");
    html += `<div class="load-problems"><strong>Some courses could not be loaded:</strong><ul>${items}</ul></div>`;
  }

  if (saveErrorMessage) {
    html += `<div class="load-problems">${escapeHtml(saveErrorMessage)}</div>`;
  }

  document.getElementById("load-problems").innerHTML = html;
}

function render() {
  const route = readRoute();
  renderHeader();
  renderNavigation(route);
  renderLoadProblems();
  document.getElementById("content").innerHTML = PAGES[route.page](route.argument);
}


// ---------------------------------------------------------
// Clicks and other events
// ---------------------------------------------------------

document.addEventListener("change", (event) => {
  if (event.target.id === "hide-completed") {
    hideCompleted = event.target.checked;
    saveSetting(STORAGE_KEY_HIDE_COMPLETED, hideCompleted);
    render();
  }
});

document.addEventListener("submit", (event) => {
  const exerciseForm = event.target.closest("[data-exercise-form]");
  if (exerciseForm) {
    event.preventDefault();
    handleExerciseFormSubmit(exerciseForm);
    return;
  }
  const lectureForm = event.target.closest("[data-lecture-form]");
  if (lectureForm) {
    event.preventDefault();
    handleLectureFormSubmit(lectureForm);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && (editing || editingLecture)) {
    stopEditing();
  }
});

// All button clicks, by what the button is for
document.addEventListener("click", (event) => {
  const target = event.target;

  // "Done" / "Late". Pressing the active one again sets it back to "todo".
  const statusButton = target.closest("[data-set-status]");
  if (statusButton && !statusButton.disabled) {
    const found = findExerciseById(statusButton.dataset.exerciseId);
    if (found) {
      const pressed = statusButton.dataset.setStatus;
      const newStatus = exerciseStatus(found.exercise) === pressed ? "todo" : pressed;
      setExerciseStatus(found.course, found.exercise, newStatus);
    }
    return;
  }

  // ✎ edit, + add, cancel, delete
  const editButton = target.closest("[data-edit-exercise]");
  if (editButton) {
    startEditing(editButton.dataset.course, editButton.dataset.editExercise);
    return;
  }
  const addButton = target.closest("[data-add-exercise]");
  if (addButton) {
    startEditing(addButton.dataset.addExercise, null);
    return;
  }
  if (target.closest("[data-edit-cancel]")) {
    stopEditing();
    return;
  }
  const deleteButton = target.closest("[data-edit-delete]");
  if (deleteButton) {
    handleExerciseDelete(deleteButton);
    return;
  }

  // Lectures: ✎ edit, + add, delete
  const editLectureButton = target.closest("[data-edit-lecture]");
  if (editLectureButton) {
    startEditingLecture(editLectureButton.dataset.course, Number(editLectureButton.dataset.editLecture));
    return;
  }
  const addLectureButton = target.closest("[data-add-lecture]");
  if (addLectureButton) {
    startEditingLecture(addLectureButton.dataset.addLecture, null);
    return;
  }
  const deleteLectureButton = target.closest("[data-lecture-delete]");
  if (deleteLectureButton) {
    handleLectureDelete(deleteLectureButton);
    return;
  }

  // Week plan toggles
  const typeToggle = target.closest("[data-toggle-type]");
  if (typeToggle) {
    const key = typeToggle.dataset.toggleType;
    weekFilters[key] = !weekFilters[key];
    saveWeekFilters();
    render();
    return;
  }
  const courseToggle = target.closest("[data-toggle-course]");
  if (courseToggle) {
    const code = courseToggle.dataset.toggleCourse;
    const hidden = new Set(weekFilters.hiddenCourses);
    if (hidden.has(code)) {
      hidden.delete(code);
    } else {
      hidden.add(code);
    }
    weekFilters.hiddenCourses = [...hidden];
    saveWeekFilters();
    render();
    return;
  }
  if (target.closest("[data-show-all-courses]")) {
    weekFilters.hiddenCourses = [];
    saveWeekFilters();
    render();
    return;
  }

  // Semester switcher
  const semesterButton = target.closest("[data-semester]");
  if (semesterButton && semesterButton.dataset.semester !== activeSemesterId) {
    // A course page from one semester doesn't exist in the other, so go to the overview.
    if (readRoute().page === "course") {
      history.replaceState(null, "", "#overview");
    }
    openSemester(semesterButton.dataset.semester);
  }
});

window.addEventListener("hashchange", () => {
  editing = null;
  editingLecture = null;
  render();
  window.scrollTo(0, 0);
});

// Re-draw every minute so "today", countdowns and the time line stay
// current — but not while a form is open, so typing isn't lost.
setInterval(() => {
  if (activeSemesterId && !editing && !editingLecture) {
    render();
  }
}, 60 * 1000);


// ---------------------------------------------------------
// Start: read the semester list, then open the right semester.
// ---------------------------------------------------------

async function start() {
  canSave = await checkServer();

  try {
    semesterIds = await loadDataFile(buildPath("semesters", "index.js"));
  } catch (error) {
    document.getElementById("content").innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`;
    return;
  }

  if (semesterIds.length === 0) {
    document.getElementById("content").innerHTML =
      `<p class="empty">No semesters listed in semesters/index.js.</p>`;
    return;
  }

  openSemester(chooseSemesterOnStartup());
}

start();
