# Studieplan

A local page with my full study plan: weekly lecture calendars, mandatory exercises, exam dates and one page per course.

## Run

```sh
python3 serve.py
```

This opens http://localhost:8000 (use `python3 serve.py 8080` for another port).

Ticking an exercise on the page writes `done: true` / `done: false` into the course file,
so the course files are the only record of your progress. Commit and push to sync it,
and `git pull` on another computer.

Opening `index.html` directly (or with `python3 -m http.server`) also shows everything,
but the checkboxes are read-only, since nothing could save them.

## Structure

```
index.html, app.js, styles.css     the page (all logic is in app.js)
serve.py                           local server that also saves ticks
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

1. Copy `semesters/_template/courses/XXX0000.js` into the semester's `courses/` folder
   and rename it to the course code, e.g. `TMA4267.js`.
2. Fill it in.
3. Add `"TMA4267"` to the `courses` list in that semester's `semester.js`.

If a listed course file is missing, the page shows a warning naming it.

## Adding a semester

1. Copy `semesters/_template` to e.g. `semesters/H27`.
2. Add course files and list them in `semester.js`.
3. Add `"H27"` to `semesters/index.js`.

## Switching semesters

Use the buttons in the top right. The page opens the semester you had open last,
except when a new semester has started since then — then it opens the new current one.
(Autumn "H" semesters start 1 August, spring "V" semesters 1 January.)

"Hide completed" and the last opened semester are remembered per browser.
