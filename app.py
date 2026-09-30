"""Relational attendance API: unique check-ins, time-outs and event reports."""
from datetime import datetime, timezone
from core import APIError, Database, csv_text, integer, iso_date, rows, text

SCHEMA = """
CREATE TABLE IF NOT EXISTS students(id INTEGER PRIMARY KEY, student_no TEXT UNIQUE NOT NULL, name TEXT NOT NULL, course TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, name TEXT NOT NULL, event_date TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS attendance(id INTEGER PRIMARY KEY,
 student_id INTEGER NOT NULL REFERENCES students(id), event_id INTEGER NOT NULL REFERENCES events(id),
 time_in TEXT NOT NULL, time_out TEXT, UNIQUE(student_id,event_id));
"""


class Attendance:
    def __init__(self, path):
        self.db = Database(path)
        self.db.initialize(SCHEMA, self.seed)

    @staticmethod
    def seed(conn):
        conn.executemany("INSERT INTO students(student_no,name,course) VALUES (?,?,?)", [
            ("DEMO-001", "Alex Rivera", "BS Computer Science"),
            ("DEMO-002", "Sam Cruz", "BS Information Technology"),
            ("DEMO-003", "Jamie Santos", "BS Computer Science")])
        conn.execute("INSERT INTO events(name,event_date) VALUES (?,?)", ("Portfolio demo workshop", datetime.now(timezone.utc).date().isoformat()))

    def report(self, conn, event_id):
        if not conn.execute("SELECT 1 FROM events WHERE id=?", (event_id,)).fetchone():
            raise APIError("Event not found.", 404)
        return rows(conn.execute("""SELECT s.id AS student_id,s.student_no,s.name,s.course,a.time_in,a.time_out,
            CASE WHEN a.id IS NULL THEN 'Absent' WHEN a.time_out IS NULL THEN 'Present' ELSE 'Completed' END AS status
            FROM students s LEFT JOIN attendance a ON a.student_id=s.id AND a.event_id=? ORDER BY s.name""", (event_id,)))

    def handle(self, method, path, data, query):
        with self.db.connect() as conn:
            if path == "/students" and method == "GET":
                return rows(conn.execute("SELECT * FROM students ORDER BY name"))
            if path == "/students" and method == "POST":
                cursor = conn.execute("INSERT INTO students(student_no,name,course) VALUES (?,?,?)", (
                    text(data.get("student_no"), "Student number", 30), text(data.get("name"), "Name"), text(data.get("course"), "Course", 80)))
                return {"id": cursor.lastrowid}
            if path == "/events" and method == "GET":
                return rows(conn.execute("SELECT * FROM events ORDER BY event_date DESC,id DESC"))
            if path == "/events" and method == "POST":
                cursor = conn.execute("INSERT INTO events(name,event_date) VALUES (?,?)", (text(data.get("name"), "Event name"), iso_date(data.get("event_date"))))
                return {"id": cursor.lastrowid}
            if path in ("/records", "/export") and method == "GET":
                try:
                    event_id = int(query.get("event_id", ["1"])[0])
                except ValueError:
                    raise APIError("Event ID must be a number.")
                report = self.report(conn, event_id)
                if path == "/export":
                    columns = ["student_no", "name", "course", "time_in", "time_out", "status"]
                    return (csv_text(columns, [[r[c] for c in columns] for r in report]), "text/csv; charset=utf-8")
                return report
            if path in ("/check-in", "/check-out") and method == "POST":
                student = integer(data.get("student_id"), "Student ID", 1)
                event = integer(data.get("event_id"), "Event ID", 1)
                if not conn.execute("SELECT 1 FROM students WHERE id=?", (student,)).fetchone() or not conn.execute("SELECT 1 FROM events WHERE id=?", (event,)).fetchone():
                    raise APIError("Student or event not found.", 404)
                now = datetime.now(timezone.utc).isoformat(timespec="seconds")
                if path == "/check-in":
                    conn.execute("INSERT INTO attendance(student_id,event_id,time_in) VALUES (?,?,?)", (student, event, now))
                else:
                    cursor = conn.execute("UPDATE attendance SET time_out=? WHERE student_id=? AND event_id=? AND time_out IS NULL", (now, student, event))
                    if cursor.rowcount == 0:
                        raise APIError("Check in first, or this attendance is already completed.", 409)
                return {"time": now}
        raise APIError("Endpoint not found.", 404)
