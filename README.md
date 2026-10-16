# Studieplan

A local page with my full study plan: weekly lecture calendars, mandatory exercises, exam dates and one page per course.

## Run

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000. (Opening `index.html` directly also works.)

## Structure

```
index.html, app.js, styles.css     the page (all logic is in app.js)
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

Ticking an exercise as done on the page is saved in the browser.
