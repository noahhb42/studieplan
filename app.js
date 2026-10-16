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
//   #main                weekly calendar of main lectures
//   #exercise            weekly calendar of exercise lectures
//   #deadlines           mandatory exercises due in the next 2 weeks
//   #exams               exam dates
//   #course/TDT4120      one course
//
// Exercise checkboxes and the last opened semester are saved
// in the browser (localStorage).
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

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "main", label: "Main lectures" },
  { id: "exercise", label: "Exercise lectures" },
  { id: "deadlines", label: "Mandatory exercises" },
  { id: "exams", label: "Exam dates" },
];



// ---------------------------------------------------------
// Saved state (ticked exercises, "hide completed" toggle,
// last opened semester)
// ---------------------------------------------------------

const STORAGE_KEY_COMPLETED = "studieplan.done";
const STORAGE_KEY_HIDE_COMPLETED = "studieplan.hideDone";
const STORAGE_KEY_SEMESTER = "studieplan.semester";

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

// Map from exercise id -> true/false. Overrides `done` from the course files.
let completedOverrides = loadSetting(STORAGE_KEY_COMPLETED, {});
let hideCompleted = loadSetting(STORAGE_KEY_HIDE_COMPLETED, true);

function exerciseId(course, exercise) {
  return `${course.code}|${exercise.name}|${exercise.due}`;
}

function isCompleted(course, exercise) {
  const id = exerciseId(course, exercise);
  if (id in completedOverrides) {
    return completedOverrides[id];
  }
  return Boolean(exercise.done);
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
  for (const result of results) {
    if (result.status === "fulfilled") {
      semester.courses.push(result.value);
    } else {
      semester.problems.push(result.reason.message);
    }
  }

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
    course.exercises = course.exercises || [];
    course.notes = course.notes || [];
    courseByCode[course.code] = course;
  });
}

async function openSemester(id) {
  try {
    const data = await loadSemester(id);
    setActiveSemester(id, data);
    rememberOpenSemester(id);
    render();
  } catch (error) {
    document.getElementById("content").innerHTML =
      `<p class="empty">${escapeHtml(error.message)}</p>`;
  }
}


// ---------------------------------------------------------
// Collecting data across all courses
// ---------------------------------------------------------

// Every exercise of every course, sorted by due date.
function getAllExercises() {
  const result = [];
  for (const course of courses) {
    for (const exercise of course.exercises) {
      result.push({
        course,
        exercise,
        daysLeft: daysUntil(exercise.due),
        completed: isCompleted(course, exercise),
      });
    }
  }
  result.sort((a, b) => a.daysLeft - b.daysLeft || a.course.code.localeCompare(b.course.code));
  return result;
}

// Every lecture of every course. Pass "Main" or "Exercise" to filter.
function getAllLectures(type) {
  const result = [];
  for (const course of courses) {
    for (const lecture of course.lectures) {
      if (type && lecture.type !== type) {
        continue;
      }
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

// One row in an exercise table.
function renderExerciseRow(item, showCourseColumn) {
  const { course, exercise, daysLeft, completed } = item;

  let urgencyClass = "";
  if (!completed && daysLeft < 0) {
    urgencyClass = "overdue";
  } else if (!completed && daysLeft <= 3) {
    urgencyClass = "soon";
  }

  const courseCell = showCourseColumn ? `<td>${renderChip(course)}</td>` : "";

  return `
    <tr class="exercise-row ${completed ? "completed" : ""}" style="${hueStyle(course)}">
      ${courseCell}
      <td class="exercise-name">${escapeHtml(exercise.name)}</td>
      <td class="tabular">
        ${formatDate(parseDate(exercise.due))}
        <span class="relative-date ${urgencyClass}">${describeDaysAway(daysLeft)}</span>
      </td>
      <td class="checkbox-cell">
        <input type="checkbox"
               data-exercise-id="${escapeHtml(exerciseId(course, exercise))}"
               ${completed ? "checked" : ""}
               aria-label="Completed">
      </td>
    </tr>`;
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

  const position = [
    `top: calc(${topHours} * var(--hour-height) + 1px)`,
    `height: calc(${durationHours} * var(--hour-height) - 2px)`,
    `left: calc(${column} / ${columnCount} * 100% + 3px)`,
    `width: calc(100% / ${columnCount} - 6px)`,
  ].join("; ");

  // Only show the full course name when the block has room for it.
  const showName = durationHours >= 1.6 && columnCount < 3;
  const tooltip = `${course.code} ${course.name} · ${lecture.start}–${lecture.end}`;

  return `
    <a class="calendar-event course-tint" href="${courseLink(course)}"
       title="${escapeHtml(tooltip)}" style="${hueStyle(course)}; ${position}">
      <span class="calendar-event-code">${escapeHtml(course.code)}</span>
      <span class="tabular">${lecture.start}–${lecture.end}</span>
      ${showName ? `<div class="calendar-event-name">${escapeHtml(course.name)}</div>` : ""}
    </a>`;
}

function renderCalendar(lectureType) {
  const lectures = getAllLectures(lectureType);
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
  const openExercises = exercises.filter((item) => !item.completed && item.daysLeft >= 0);
  const overdueCount = exercises.filter((item) => !item.completed && item.daysLeft < 0).length;
  const nextDeadline = openExercises[0];
  const nextExam = getUpcomingExams()[0];

  // --- Stats row ---
  const nextDeadlineHtml = nextDeadline
    ? `<div class="stat-value">${escapeHtml(nextDeadline.course.code)} · ${escapeHtml(nextDeadline.exercise.name)}</div>
       <div class="stat-detail">${formatDate(parseDate(nextDeadline.exercise.due))} · ${describeDaysAway(nextDeadline.daysLeft)}</div>`
    : `<div class="stat-value">Nothing due</div>`;

  const nextExamHtml = nextExam
    ? `<div class="stat-value">${escapeHtml(nextExam.course.code)} · ${formatShortDate(nextExam.course.exam.date)}</div>
       <div class="stat-detail">${describeDaysAway(nextExam.daysLeft)} · ${escapeHtml(nextExam.course.exam.time || "")}</div>`
    : `<div class="stat-value">${anyExamDates() ? "No exams left" : "No exam dates yet"}</div>`;

  const overdueHtml = overdueCount > 0
    ? `<span class="relative-date overdue" style="margin: 0">${overdueCount} overdue, not ticked</span>`
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
    const finished = isWeekday && lecture.endMinutes < nowMinutes;
    html += `
      <a class="today-item ${finished ? "finished" : ""}" href="${courseLink(lecture.course)}">
        <span class="today-time">${lecture.start}–${lecture.end}</span>
        ${renderChip(lecture.course, { asLink: false })}
        <span class="today-course-name">${escapeHtml(lecture.course.name)}</span>
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
  const total = course.exercises.length;
  const completedCount = course.exercises.filter((exercise) => isCompleted(course, exercise)).length;
  const progressPercent = total > 0 ? (completedCount / total) * 100 : 0;

  const nextExercise = course.exercises
    .filter((exercise) => !isCompleted(course, exercise) && daysUntil(exercise.due) >= 0)
    .sort((a, b) => daysUntil(a.due) - daysUntil(b.due))[0];

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
      <div class="info-row"><span>Exercises</span><span class="tabular">${total > 0 ? `${completedCount} / ${total}` : "None added"}</span></div>
      <div class="progress-bar"><div class="progress-bar-fill" style="width: ${progressPercent}%"></div></div>
      <div class="info-row"><span>Next due</span><span>${nextDueText}</span></div>
      <div class="info-row"><span>Exam</span><span>${examText}</span></div>
    </a>`;
}

function renderMainLecturesPage() {
  return `
    <h2>Main lectures</h2>
    <p class="lede">Weekly calendar. Overlapping lectures sit side by side. Click a block to open the course.</p>
    ${renderCalendar("Main")}`;
}

function renderExerciseLecturesPage() {
  return `
    <h2>Exercise lectures</h2>
    <p class="lede">Weekly calendar of exercise lectures (øvingsforelesninger).</p>
    ${renderCalendar("Exercise")}`;
}

function renderDeadlinesPage() {
  const exercises = getAllExercises();

  const dueSoon = exercises.filter((item) => {
    const inWindow = item.daysLeft >= 0 && item.daysLeft <= DEADLINE_WINDOW_DAYS;
    const hidden = hideCompleted && item.completed;
    return inWindow && !hidden;
  });

  const overdue = exercises.filter((item) => item.daysLeft < 0 && !item.completed);

  const windowEnd = new Date(startOfToday().getTime() + DEADLINE_WINDOW_DAYS * MS_PER_DAY);

  let rows = dueSoon.map((item) => renderExerciseRow(item, true)).join("");
  if (dueSoon.length === 0) {
    rows = `<tr><td colspan="4" class="empty">Nothing due in the next two weeks.</td></tr>`;
  }

  let html = `
    <h2>Mandatory exercises</h2>
    <p class="lede">
      Due in the next 2 weeks (to ${formatDate(windowEnd)}).
      Tick to mark completed — saved in this browser.
    </p>
    <div class="toolbar">
      <label>
        <input type="checkbox" id="hide-completed" ${hideCompleted ? "checked" : ""}>
        Hide completed
      </label>
    </div>
    <div class="panel">
      <table>
        <thead>
          <tr><th>Course</th><th>Exercise</th><th>Due</th><th>Done</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  if (overdue.length > 0) {
    html += `
      <details>
        <summary>${overdue.length} past due and not ticked</summary>
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

  // Lectures: main lectures first, then by weekday and start time
  const lectures = course.lectures.slice().sort((a, b) => {
    const byType = (a.type === "Main" ? 0 : 1) - (b.type === "Main" ? 0 : 1);
    const byDay = WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day);
    const byStart = timeToMinutes(a.start) - timeToMinutes(b.start);
    return byType || byDay || byStart;
  });

  let lectureRows = lectures.map((lecture) => `
    <tr>
      <td>${lecture.day}</td>
      <td class="tabular">${lecture.start}–${lecture.end}</td>
      <td>${lectureTypeLabel(lecture.type)}</td>
    </tr>`).join("");
  if (lectures.length === 0) {
    lectureRows = `<tr><td colspan="3" class="empty">No lectures.</td></tr>`;
  }

  // Exercises, sorted by due date
  const exercises = course.exercises
    .map((exercise) => ({
      course,
      exercise,
      daysLeft: daysUntil(exercise.due),
      completed: isCompleted(course, exercise),
    }))
    .sort((a, b) => a.daysLeft - b.daysLeft);
  const completedCount = exercises.filter((item) => item.completed).length;

  let exerciseRows = exercises.map((item) => renderExerciseRow(item, false)).join("");
  if (exercises.length === 0) {
    exerciseRows = `<tr><td colspan="3" class="empty">None.</td></tr>`;
  }

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
            <thead><tr><th>Day</th><th>Time</th><th>Type</th></tr></thead>
            <tbody>${lectureRows}</tbody>
          </table>
        </div>

        <h3 class="section-title">Exam</h3>
        <div class="panel stat">${examHtml}</div>

        ${notesHtml}
      </div>

      <div>
        <h3 class="section-title">Mandatory exercises · ${completedCount}/${exercises.length} done</h3>
        <div class="panel">
          <table>
            <thead><tr><th>Exercise</th><th>Due</th><th>Done</th></tr></thead>
            <tbody>${exerciseRows}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

const PAGES = {
  overview: renderOverviewPage,
  main: renderMainLecturesPage,
  exercise: renderExerciseLecturesPage,
  deadlines: renderDeadlinesPage,
  exams: renderExamsPage,
  course: renderCoursePage,
};


// ---------------------------------------------------------
// Drawing the page and handling clicks
// ---------------------------------------------------------

// "#course/TDT4120" -> { page: "course", argument: "TDT4120" }
function readRoute() {
  const hash = decodeURIComponent(location.hash.slice(1)) || "overview";
  const [page, argument] = hash.split("/");

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

function render() {
  const route = readRoute();
  renderHeader();
  renderNavigation(route);
  renderLoadProblems();
  document.getElementById("content").innerHTML = PAGES[route.page](route.argument);
}

// Shows a warning if some course files listed in semester.js couldn't be loaded.
function renderLoadProblems() {
  const box = document.getElementById("load-problems");
  if (loadProblems.length === 0) {
    box.innerHTML = "";
    return;
  }
  const items = loadProblems.map((message) => `<li>${escapeHtml(message)}</li>`).join("");
  box.innerHTML = `<div class="load-problems"><strong>Some courses could not be loaded:</strong><ul>${items}</ul></div>`;
}

document.addEventListener("change", (event) => {
  const input = event.target;

  if (input.id === "hide-completed") {
    hideCompleted = input.checked;
    saveSetting(STORAGE_KEY_HIDE_COMPLETED, hideCompleted);
    render();
    return;
  }

  if (input.dataset.exerciseId) {
    completedOverrides[input.dataset.exerciseId] = input.checked;
    saveSetting(STORAGE_KEY_COMPLETED, completedOverrides);
    render();
  }
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-semester]");
  if (!button || button.dataset.semester === activeSemesterId) {
    return;
  }

  // A course page from one semester doesn't exist in the other, so go to the overview.
  if (readRoute().page === "course") {
    history.replaceState(null, "", "#overview");
  }
  openSemester(button.dataset.semester);
});

window.addEventListener("hashchange", () => {
  render();
  window.scrollTo(0, 0);
});

// Re-draw every minute so "today", countdowns and the time line stay current.
setInterval(() => {
  if (activeSemesterId) {
    render();
  }
}, 60 * 1000);

// Start: read the semester list, then open the right semester.
async function start() {
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
