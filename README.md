# Studieplan

A local page with my full study plan: overview, week plan, mandatory exercises,
exam dates and one page per course — for every semester.

## Run

```sh
fagplan
```

This starts `serve.py` and opens http://localhost:8000. Stop it with Ctrl+C.
(Without the `fagplan` command: `python3 serve.py`, or `python3 serve.py 8080`
for another port.)

Opening `index.html` directly (or with `python3 -m http.server`) also shows everything,
but marking and editing exercises is turned off, since nothing could save the changes.

## The `fagplan` command

```sh
fagplan                     # start the page, from any folder
fagplan update "message"    # git add . / git commit -m "message" / git push
fagplan "message"           # same as update
fagplan help                # list the commands
```

- It runs in the repo folder, so your terminal stays where it was.
- Quotes are optional: `fagplan Øving 9 levert` works too.
- Without a message, nothing is committed and it asks for one.
- If nothing has changed, it says "Nothing new to commit." and still pushes
  (in case earlier commits weren't pushed).
- The first push links the branch to `origin` if it isn't already.

### Setup (once per computer)

```sh
grep -qF 'studieplan/fagplan.sh' ~/.zshrc 2>/dev/null || echo 'source "$HOME/Github/studieplan/fagplan.sh"' >> ~/.zshrc; source ~/.zshrc
```

This adds one line to `~/.zshrc` that loads `fagplan.sh` straight from the repo,
so changes to the script apply to every new terminal without reinstalling.
Running it twice is harmless.

## Syncing between computers

Everything you change on the page is saved in the course files, so they are the
only record of your progress. Save with `fagplan "message"` and run `git pull` on
the other computer.

View settings ("hide completed", week plan toggles, last opened semester) are
remembered per browser and are not synced.

## Pages

- **Overview** — next deadline, next exam, how many exercises are left/overdue,
  today's lectures, and a card per course (approval progress, next due, exam).
  Lectures happening right now are highlighted in green, with a bar showing how
  far into the lecture you are. Finished ones are greyed out.
- **Week plan** — lectures and exercise lectures in one calendar (exercise
  lectures are striped). Toggle each type, or individual courses, on and off.
  Overlapping lectures sit side by side; a line marks the current time.
- **Mandatory exercises** — everything due in the next 2 weeks, with *Hide
  completed*. Mandatory exercises whose deadline has passed without being marked
  are listed under "past due and not marked".
- **Exam dates** — all exams sorted by date, with days left.
- **Course pages** (the coloured course codes) — lectures, exam, course material,
  notes, and all exercises with approval progress.

The page follows your system's light/dark mode.

## Exercises

On the course pages and the Mandatory exercises page:

- **Done** — submitted on time; counts towards the course's approval.
- **Late** — submitted after the deadline; no longer shows as due or overdue,
  but does **not** count towards approval.
- Pressing the active button again sets the exercise back to "todo".
- **✎** edits an exercise (name, due date, time, voluntary) or deletes it
  (Delete asks for a second click).
- **+ Add exercise** on a course page adds one. It suggests the next name and a
  date one week after the last exercise.

### Approval (e.g. 8 of 12)

By default (`required: null`) every mandatory exercise must be approved. For
courses that need fewer, set e.g. `required: 8` in the course file. The page shows
"6 of 8 approved · 2 more needed, 5 left", and warns in red when fewer exercises
are left than you still need.

### Voluntary exercises

Add `optional: true` to an exercise (or tick *Voluntary* when editing it on the
page). It's still listed on the course page, but never counts towards approval,
never shows as overdue, and is left out of the "Mandatory exercises" page.

### Deadline times

Exercises can have a `time`, e.g. `{ due: "2026-10-18", time: "14:00", ... }`.
It's shown next to the date, and the exercise counts as overdue once that time has
passed. Without a time, it's due at the end of the day.

## Course files

Each course is one file, e.g. `semesters/H26/courses/TDT4120.js`:

```js
defineCourse({
  code: "TDT4120",
  name: "Algoritmer og datastrukturer",
  color: "#FDE2E2",                 // pastel colour, optional

  lectures: [
    { day: "Friday", start: "12:15", end: "15:00", type: "Main" },      // or "Exercise"
  ],

  required: 7,                      // null = all mandatory exercises

  exercises: [
    { due: "2026-10-22", time: "23:59", name: "Øving 8", status: "todo" },
    { due: "2026-10-30", name: "Øving 4", status: "todo", optional: true },
  ],

  exam: { date: "2026-12-09", time: "15:00" },   // or null

  materials: [
    { title: "Introduction to Algorithms", note: "Cormen et al. · 4th edition" },
    { title: "Course page", url: "https://..." },
  ],

  notes: ["Anything worth remembering"],
});
```

- `status` is `"todo"`, `"done"` or `"late"`. The page changes it for you.
- In `materials`, `note` and `url` are optional; a `url` makes the title a link.
  It's only a list, so no files are downloaded or stored.
- `semesters/_template/courses/XXX0000.js` has the same fields with comments.

## Structure

```
index.html, app.js, styles.css     the page (all logic is in app.js)
serve.py                           local server that also saves your changes
fagplan.sh                         the `fagplan` terminal command
.gitignore                         keeps macOS .DS_Store files out of git
semesters/
  index.js                         list of semesters
  H26/
    semester.js                    list of courses in H26
    courses/
      TDT4120.js                   one file per course
      ...
  V27/
    ...
  _template/                       copy this to start a new semester
```

The files in `semesters/` are only data. The lists in `index.js` and `semester.js`
decide what is loaded (a browser page can't look inside folders by itself).

## Adding a course

1. Copy `semesters/_template/courses/XXX0000.js` into the semester's `courses/`
   folder and rename it to the course code, e.g. `TMA4267.js`.
2. Fill it in.
3. Add `"TMA4267"` to the `courses` list in that semester's `semester.js`.

If a listed course file is missing, the page shows a warning naming it.

## Adding a semester

1. Copy `semesters/_template` to e.g. `semesters/H27`.
2. Add course files and list them in `semester.js`.
3. Add `"H27"` to `semesters/index.js`.

## Switching semesters

Use the buttons in the top right; a blue dot marks the current semester. The page
opens the semester you had open last, except when a new semester has started since
then — then it opens the new current one. (Autumn "H" semesters start 1 August,
spring "V" semesters 1 January.)
