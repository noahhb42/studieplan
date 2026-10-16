"""
Studieplan local server.

    python3 serve.py          # http://localhost:8000
    python3 serve.py 8080     # another port

Serves the page like `python3 -m http.server`, and also lets the page save
ticked exercises: ticking a box changes `done: false` to `done: true` (or back)
in the course file, e.g. semesters/H26/courses/TFY4107.js.
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


def set_exercise_done(semester, course_file, due, name, done):
    """
    Finds the exercise line in the course file, e.g.

        { due: "2026-10-18", name: "Øving 9",  done: false },

    and changes its `done` value. Returns an error message, or None on success.
    """
    if not (is_safe_name(semester) and is_safe_name(course_file)):
        return "Invalid semester or course name."

    path = SEMESTERS_DIR / semester / "courses" / f"{course_file}.js"
    if not path.is_file():
        return f"Could not find {path.relative_to(ROOT)}."

    due_text = f"due: {json.dumps(due)}"
    name_text = f"name: {json.dumps(name, ensure_ascii=False)}"
    new_value = "true" if done else "false"

    with write_lock:
        lines = path.read_text(encoding="utf-8").splitlines(keepends=True)

        for index, line in enumerate(lines):
            if due_text in line and name_text in line and re.search(r"done:\s*(true|false)", line):
                lines[index] = re.sub(r"done:\s*(true|false)", f"done: {new_value}", line, count=1)
                path.write_text("".join(lines), encoding="utf-8")
                return None

    return f"Could not find {name} ({due}) in {path.relative_to(ROOT)}."


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
        if self.path != "/api/exercise":
            self.send_json(404, {"error": "Unknown address."})
            return

        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            error = set_exercise_done(
                semester=body["semester"],
                course_file=body["courseFile"],
                due=body["due"],
                name=body["name"],
                done=bool(body["done"]),
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
