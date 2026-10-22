from datetime import datetime
import unittest
from zoneinfo import ZoneInfo
from discover import run, discover, league_candidates, NotReady
from dump_calendar import SourceUnavailableError

ENV = {'SUPABASE_PROJECT_URL': 'https://backend.example', 'MATCHES_SYNC_SECRET': 'test-only'}
MARCH = datetime(2027, 3, 10, 1, 0, tzinfo=ZoneInfo('Europe/Oslo'))


def team_page(*links):
    return ''.join(f'<a href="/fotballdata/turnering/hjem/?fiksId={tid}">{label}</a>' for tid, label in links)


def table(label, year, teams):
    rows = ''.join(f'<tr><td>{i}</td><td><a href="/fotballdata/lag/hjem/?fiksId={fid}">{name} </a></td></tr>' for i, (fid, name) in enumerate(teams, 1))
    return f'<title>{label} {year} - Norges Fotballforbund</title><table class="tablesorter customTableSorter"><tbody>{rows}</tbody></table>'


def league(team_id, name, count):
    return [(team_id, name)] + [(str(9000 + i), f'Lag {i}') for i in range(count - 1)]


def site(a_links=None, b_links=None, extra=None):
    pages = {
        '/lag/hjem/?fiksId=311': team_page(*(a_links or [('300001', '4. div. menn avd. 02'), ('308000', 'NM Menn 2028 kvalifisering')])),
        '/lag/hjem/?fiksId=6458': team_page(*(b_links or [('300002', '6. div. menn avd. 03')])),
        '/turnering/tabell/?fiksId=300001': table('4. div. menn avd. 02', 2027, league('311', 'Fagerborg', 14)),
        '/turnering/tabell/?fiksId=300002': table('6. div. menn avd. 03', 2027, league('6458', 'Fagerborg 2', 12)),
        **(extra or {}),
    }
    seen = []
    def fetch(url):
        seen.append(url)
        for key, value in pages.items():
            if url.endswith(key):
                return value
        raise SourceUnavailableError(f'404 {url}')
    return fetch, seen


class DiscoveryTests(unittest.TestCase):
    def go(self, fetch, result=None, now=MARCH, env=ENV):
        calls = []
        def call(url, secret, body):
            calls.append(body)
            return result or {'activated': True, 'season': body['config']['season']}
        code = run(env=env, now=now, fetch=fetch, call=call, manifest=lambda: {'season': 2026})
        return code, calls

    def test_2027_both_found_activates_derived_config(self):
        fetch, seen = site()
        code, calls = self.go(fetch)
        self.assertEqual(code, 0)
        config = calls[0]['config']
        self.assertEqual(calls[0]['action'], 'discover')
        self.assertEqual(config['season'], 2027)
        self.assertEqual([(t['team'], t['tournament_id'], t['team_id'], t['expected_teams'], t['league'], t['club_name']) for t in config['teams']],
            [('A-laget', '300001', '311', 14, '4. div. menn avd. 02', 'Fagerborg'), ('B-laget', '300002', '6458', 12, '6. div. menn avd. 03', 'Fagerborg 2')])
        self.assertFalse(any('308000' in u for u in seen), 'NM tournament must never be fetched as league')

    def test_nm_is_never_a_league_candidate(self):
        self.assertEqual(league_candidates(team_page(('1', '5. div. menn avd. 01'), ('2', 'NM Menn 2028 kvalifisering'), ('3', 'Oslo Cup'))), {'1': '5. div. menn avd. 01'})

    def test_only_a_found_no_backend(self):
        fetch, _ = site(b_links=[('205410', '7. div. menn avd. 02')], extra={'/turnering/tabell/?fiksId=205410': table('7. div. menn avd. 02', 2026, league('6458', 'Fagerborg 2', 10))})
        self.assertEqual(self.go(fetch), (0, []))

    def test_ambiguous_candidates_no_backend(self):
        fetch, _ = site(a_links=[('300001', '4. div. menn avd. 02'), ('300009', '4. div. menn avd. 03')], extra={'/turnering/tabell/?fiksId=300009': table('4. div. menn avd. 03', 2027, league('311', 'Fagerborg', 14))})
        self.assertEqual(self.go(fetch), (0, []))

    def test_empty_table_is_source_unavailable(self):
        fetch, _ = site(extra={'/turnering/tabell/?fiksId=300002': table('6. div. menn avd. 03', 2027, [])})
        self.assertEqual(self.go(fetch), (0, []))
        with self.assertRaises(SourceUnavailableError):
            discover(2027, fetch)

    def test_fotball_no_failure_is_warning_without_backend(self):
        def down(url):
            raise SourceUnavailableError('offline')
        self.assertEqual(self.go(down), (0, []))

    def test_no_op_when_season_current_and_no_network(self):
        def never(url):
            raise AssertionError('no network')
        self.assertEqual(self.go(never, now=datetime(2026, 10, 22, 1, tzinfo=ZoneInfo('Europe/Oslo'))), (0, []))

    def test_backend_failure_is_red(self):
        fetch, _ = site()
        calls = []
        def broken(url, secret, body):
            calls.append(body); raise RuntimeError('500')
        self.assertEqual(run(env=ENV, now=MARCH, fetch=fetch, call=broken, manifest=lambda: {'season': 2026}), 1)
        self.assertEqual(len(calls), 1)


if __name__ == '__main__':
    unittest.main()
