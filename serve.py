"""
Studieplan local server.

    python3 serve.py          # http://localhost:8000
    python3 serve.py 8080     # another port

Serves the page like `python3 -m http.server`, and also lets the page save
exercises: marking one Done/Late, editing, adding or deleting it rewrites the
`exercises: [...]` list in the course file, e.g. semesters/H26/courses/TFY4107.js.
Everything else in the file is left as it is.
The files are the only place progress is stored, so commit and push to sync
between computers.
"""

import json
import re
import sys
import threading
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SEMESTERS_DIR = ROOT / "semesters"

# Only one request edits a file at a time.
write_lock = threading.Lock()


def is_safe_name(name):
    """A folder or file name without slashes or '..' (so it can't leave semesters/)."""
    return isinstance(name, str) and name != "" and "/" not in name and "\\" not in name and ".." not in name


STATUSES = ("todo", "done", "late")
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TIME_PATTERN = re.compile(r"^\d{2}:\d{2}$")


def validate_exercises(exercises):
    """Checks the list sent by the page. Returns an error message or None."""
    if not isinstance(exercises, list):
        return "Exercises must be a list."
    for exercise in exercises:
        if not isinstance(exercise, dict):
            return "Each exercise must be an object."
        if not DATE_PATTERN.match(str(exercise.get("due", ""))):
            return f"Invalid due date: {exercise.get('due')!r}."
        time = exercise.get("time")
        if time is not None and not TIME_PATTERN.match(str(time)):
            return f"Invalid time: {time!r}."
        if not isinstance(exercise.get("name"), str) or not exercise["name"].strip():
            return "Every exercise needs a name."
        if exercise.get("status") not in STATUSES:
            return f"Unknown status {exercise.get('status')!r}."
        if "optional" in exercise and not isinstance(exercise["optional"], bool):
            return "`optional` must be true or false."
    return None


def format_exercises(exercises):
    """
    Formats the exercises the same way as in the course files, with the
    names lined up:

      exercises: [
        { due: "2026-10-18", time: "23:59", name: "Øving 9",  status: "todo" },
        { due: "2026-10-25",                name: "Øving 10", status: "todo", optional: true },
      ],
    """
    if not exercises:
        return "exercises: []"

    any_time = any(exercise.get("time") for exercise in exercises)
    name_width = max(len(json.dumps(exercise["name"], ensure_ascii=False)) for exercise in exercises) + 1

    lines = ["exercises: ["]
    for exercise in exercises:
        due = f"due: {json.dumps(exercise['due'])}, "
        if exercise.get("time"):
            time = f"time: {json.dumps(exercise['time'])}, "
        else:
            time = " " * len('time: "00:00", ') if any_time else ""
        name = f"name: {(json.dumps(exercise['name'], ensure_ascii=False) + ',').ljust(name_width)} "
        status = f"status: {json.dumps(exercise['status'])}"
        optional = ", optional: true" if exercise.get("optional") else ""
        lines.append(f"    {{ {due}{time}{name}{status}{optional} }},")
    lines.append("  ]")
    return "\n".join(lines)


def find_exercises_block(text):
    """
    Returns (start, end) of `exercises: [ ... ]` in the course file text,
    by matching brackets (and skipping over strings and comments).
    """
    # The field itself, at the start of a line (not the word in a comment)
    match = re.search(r"^[ \t]*exercises:\s*\[", text, re.MULTILINE)
    if match is None:
        return None
    start = match.start() + len(match.group(0)) - len(match.group(0).lstrip())
    position = match.end() - 1
    depth = 0
    while position < len(text):
        character = text[position]
        if character in "\"'":
            # skip a string
            position = text.index(character, position + 1)
            while text[position - 1] == "\\":
                position = text.index(character, position + 1)
        elif text.startswith("//", position):
            position = text.index("\n", position)
        elif character == "[":
            depth += 1
        elif character == "]":
            depth -= 1
            if depth == 0:
                return start, position + 1
        position += 1
    return None


def save_exercises(semester, course_file, exercises):
    """Replaces the course file's exercise list. Returns an error message or None."""
    if not (is_safe_name(semester) and is_safe_name(course_file)):
        return "Invalid semester or course name."

    error = validate_exercises(exercises)
    if error:
        return error

    path = SEMESTERS_DIR / semester / "courses" / f"{course_file}.js"
    if not path.is_file():
        return f"Could not find {path.relative_to(ROOT)}."

    with write_lock:
        text = path.read_text(encoding="utf-8")
        block = find_exercises_block(text)
        if block is None:
            return f"Could not find the exercises list in {path.relative_to(ROOT)}."
        start, end = block
        text = text[:start] + format_exercises(exercises) + text[end:]
        path.write_text(text, encoding="utf-8")

    return None


class StudieplanHandler(SimpleHTTPRequestHandler):

    def end_headers(self):
        # Never cache, so a reload always shows the latest course files.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        # The page calls this to find out whether it can save ticks.
        if self.path == "/api/ping":
            self.send_json(200, {"ok": True})
            return
        super().do_GET()

    def do_POST(self):
        if self.path != "/api/exercises":
            self.send_json(404, {"error": "Unknown address."})
            return

        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            error = save_exercises(
                semester=body["semester"],
                course_file=body["courseFile"],
                exercises=body["exercises"],
            )
        except (ValueError, KeyError) as exception:
            error = f"Bad request: {exception}"

        if error:
            self.send_json(400, {"error": error})
        else:
            self.send_json(200, {"ok": True})

    def send_json(self, status, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        # Only log saves and errors, not every file the page loads.
        if self.command == "POST" or (len(args) > 1 and str(args[1]).startswith(("4", "5"))):
            super().log_message(format, *args)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    handler = partial(StudieplanHandler, directory=str(ROOT))

    try:
        server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    except OSError:
        print(f"Port {port} is already in use. Try: python3 serve.py {port + 1}")
        sys.exit(1)

    url = f"http://localhost:{port}"
    print(f"Studieplan running at {url}  (Ctrl+C to stop)")
    webbrowser.open(url)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
