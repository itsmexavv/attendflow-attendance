import csv
import io
import sqlite3
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path
from core import APIError, csv_text, money
from app import Attendance


class BusinessTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.attendance = Attendance(Path(self.temp.name)/"test.db")

    def tearDown(self):
        self.temp.cleanup()

    def call(self, app, method, path, data=None, query=None):
        return app.handle(method, path, data or {}, query or {})

    def test_export_neutralizes_spreadsheet_formulas(self):
        value = csv_text(['note'], [[' =HYPERLINK("x")']])
        self.assertTrue(list(csv.reader(io.StringIO(value)))[1][0].startswith("'"))

    def test_attendance_lifecycle_and_absent_report(self):
        data = {'student_id':1,'event_id':1}
        with self.assertRaises(APIError):
            self.call(self.attendance,'POST','/check-out',data)
        self.call(self.attendance,'POST','/check-in',data)
        with self.assertRaises(sqlite3.IntegrityError):
            self.call(self.attendance,'POST','/check-in',data)
        self.call(self.attendance,'POST','/check-out',data)
        with self.assertRaises(APIError):
            self.call(self.attendance,'POST','/check-out',data)
        report = self.call(self.attendance,'GET','/records')
        self.assertEqual(sorted(r['status'] for r in report),['Absent','Absent','Completed'])
        completed = next(r for r in report if r['status']=='Completed')
        self.assertLessEqual(completed['time_in'],completed['time_out'])

    def test_attendance_is_unique_per_event(self):
        new = self.call(self.attendance,'POST','/events',{'name':'Second','event_date':'2026-10-01'})
        for event in [1,new['id']]:
            self.call(self.attendance,'POST','/check-in',{'student_id':1,'event_id':event})
        self.assertEqual(sum(r['status']=='Present' for r in self.call(self.attendance,'GET','/records',query={'event_id':[str(new['id'])]})),1)

    def test_unknown_student_and_invalid_date(self):
        with self.assertRaises(APIError):
            self.call(self.attendance,'POST','/check-in',{'student_id':999,'event_id':1})
        with self.assertRaises(APIError):
            self.call(self.attendance,'POST','/events',{'name':'Invalid','event_date':'2026-02-30'})
