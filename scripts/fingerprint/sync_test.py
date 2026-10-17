import hashlib
import json
from pathlib import Path
import tempfile
import unittest
import urllib.error
from unittest.mock import patch
from sync import run, backend
from dump_calendar import dump_calendar, SourceUnavailableError

ENV = {'SUPABASE_PROJECT_URL': 'https://backend.example', 'MATCHES_SYNC_SECRET': 'test-only'}


class SyncTests(unittest.TestCase):
    def exercise(self, source=lambda: 'valid-calendar', call=lambda *args: {'success': True}):
        with tempfile.TemporaryDirectory() as folder:
            file = Path(folder) / 'fingerprint.txt'
            file.write_text('old')
            calls = []
            def invoke(*args):
                calls.append(args[0])
                return call(*args)
            code = run(env=ENV, source=source, call=invoke, fingerprint_file=file)
            return code, file.read_text(), calls

    def test_non_xlsx_no_backend_no_fingerprint(self):
        with tempfile.TemporaryDirectory() as folder:
            file = Path(folder) / '205403.xlsx'
            file.write_text('<html>unavailable</html>')
            code, fp, calls = self.exercise(source=lambda: dump_calendar(file))
        self.assertEqual((code, fp, calls), (0, 'old', []))

    def test_backend_source_keeps_fingerprint(self):
        def unavailable(*args):
            raise SourceUnavailableError('source offline')
        code, fp, calls = self.exercise(call=unavailable)
        self.assertEqual((code, fp, len(calls)), (0, 'old', 1))

    def test_second_backend_source_keeps_fingerprint(self):
        def call(url, secret):
            if url.endswith('standings-scraper'):
                raise SourceUnavailableError('partial source')
        code, fp, calls = self.exercise(call=call)
        self.assertEqual((code, fp, len(calls)), (0, 'old', 2))

    def test_backend_http_errors_fatal(self):
        for status in (401, 500):
            def fail(*args):
                raise urllib.error.HTTPError('https://backend.example', status, 'error', {}, None)
            self.assertEqual(self.exercise(call=fail)[:2], (1, 'old'))

    def test_programming_error_fatal(self):
        def fail():
            raise TypeError('programming failure')
        self.assertEqual(self.exercise(source=fail), (1, 'old', []))

    def test_missing_config_fatal(self):
        self.assertEqual(run(env={}), 1)

    def test_success_updates_fingerprint(self):
        code, fp, calls = self.exercise()
        self.assertEqual(code, 0)
        self.assertEqual(fp, hashlib.sha256(b'valid-calendar').hexdigest())
        self.assertEqual(len(calls), 2)

    def test_official_upcoming_dash_is_valid(self):
        import datetime
        import openpyxl
        with tempfile.TemporaryDirectory() as folder:
            file = Path(folder) / '205410.xlsx'
            wb = openpyxl.Workbook()
            wb.active.append(['Runde', 'Dato', 'Dag', 'Tid', 'Hjemmelag', 'Resultat', 'Bortelag', 'Bane', 'Turnering', 'Kampnummer'])
            count = 0
            for home in range(10):
                for away in range(10):
                    if home == away: continue
                    count += 1
                    wb.active.append(['1', datetime.datetime(2026, 10, 17), 'lørdag', '20:15', f'Team {home}', '-', f'Team {away}', 'Bane', 'League', str(count)])
            wb.save(file)
            self.assertIn('Team 0|-|Team 1', dump_calendar(file))

    def test_response_contract(self):
        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self): return json.dumps(self.payload).encode()
        for payload, error in [({'success': False, 'source_unavailable': True}, SourceUnavailableError), ({'success': False, 'error': 'database'}, RuntimeError), ({}, RuntimeError)]:
            response = Response()
            response.payload = payload
            with patch('urllib.request.urlopen', return_value=response):
                with self.assertRaises(error): backend('https://backend.example', 'test-only')


if __name__ == '__main__': unittest.main()
