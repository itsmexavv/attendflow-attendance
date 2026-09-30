# AttendFlow — attendance API and dashboard

**Explore:** backend development, relational modeling, report queries and API testing.

![AttendFlow demo](screenshot.png)

## Run this independent project

Requires Python **3.11+**. The app and tests use only Python's standard library; no pip installation, API key, or other repository is required.

```bash
git clone https://github.com/itsmexavv/attendflow-attendance.git
cd attendflow-attendance
python run.py
```

Open **http://127.0.0.1:8000/**. On Windows, use `py run.py` if `python` is unavailable. Stop the server with Ctrl+C.

**Run in GitHub Codespaces:** click **Code → Codespaces → Create codespace on main**, then run `python run.py` in the terminal. Open the browser notification, or the globe beside port **8000** in the **Ports** tab. Keep the port Private and stop the Codespace after testing. GitHub's file viewer and GitHub Pages do not execute this Python backend.

For separate apps on one computer, choose another port: `python run.py --port 8001`. Use `--data-dir demo-data` for a separate synthetic dataset. SQLite data is created automatically in data/ and survives restarts. Private databases are excluded from Git.

## Portfolio materials

- [Architecture and design choices](ARCHITECTURE.md)
- [Interview walkthrough and improvement ideas](PORTFOLIO.md)
- [Security boundaries](SECURITY.md)
- A local **Demo guide** page in the app
- Independent unit and HTTP tests, plus GitHub Actions on Python 3.11, 3.12 and 3.13

## Problem and workflow

A workshop organizer needs reliable check-in/out records and a report that also includes absent students. The project registers students and events, records attendance, rejects duplicates and exports event CSVs.

From the repository root, run `python run.py`, then open **http://127.0.0.1:8000/**.

1. Select the seeded workshop. All demo students start as Absent.
2. Check in one student. Their status becomes Present.
3. Check out that student. Their status becomes Completed.
4. Add another event. The same student starts as Absent for that event.
5. Export CSV and inspect the absent students as well as the completed attendance.

## Data model

`students` contains unique student number, name and course. `events` contains event name and date. `attendance` references both tables and stores UTC check-in/out timestamps. `UNIQUE(student_id,event_id)` enforces one record per student/event pair.

## API

| Method | Endpoint | Request or result |
| --- | --- | --- |
| GET / POST | `/api/attendance/students` | List; create with `{student_no, name, course}` |
| GET / POST | `/api/attendance/events` | List; create with `{name, event_date}` |
| POST | `/api/attendance/check-in` | `{student_id, event_id}` |
| POST | `/api/attendance/check-out` | `{student_id, event_id}` |
| GET | `/api/attendance/records?event_id=1` | All students and their status for the selected event |
| GET | `/api/attendance/export?event_id=1` | CSV with student, course, times and status |

The API returns 409 for duplicate attendance or invalid repeated checkout, 404 for missing students/events and 400 for malformed fields. Dates use `YYYY-MM-DD`. The UI displays stored UTC timestamps in the browser's local timezone.

## Key design choices

Database uniqueness protects against concurrent duplicate requests. The report uses a `LEFT JOIN` from students to attendance, constrained by selected event, so it does not lose students without records. Checkout updates only a row that has no time-out.

## Verification

Run `python -m unittest discover -v`. Tests cover check-in/out transitions, duplicate prevention, one student across two events, missing IDs, invalid dates, absent reporting and HTTP responses. Browser checks cover the buttons and creation forms.

## Extensions to make yourself

- Define a lateness policy based on each event's start time; test exact boundary times.
- Add a separate event-registration table so events can have different rosters.
- Add safe student editing and CSV student import.
- Add authenticated organizer/student roles using a suitable framework.

## Limits

Every student is included in every event roster. No registration filtering, lateness rules, QR scanning, identity verification or date restrictions. Event date is descriptive; demo check-ins use the current time. The project contains no real student information and is for local use.


Built with AI assistance as a learning starter. Understand the design, verify the behavior, and add your own documented improvement before presenting it in an interview.

## Optional browser verification

The app itself needs no Node.js. To run its end-to-end workflow and responsive-layout checks locally, install Node.js 22+, then:

```bash
npm install --ignore-scripts
npx playwright install chromium
npm run test:browser
```

The script starts a separate server using disposable data, then closes it. GitHub Actions also runs these checks and uploads fresh desktop/mobile screenshots as the `browser-verification` artifact.
