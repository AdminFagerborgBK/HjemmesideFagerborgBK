"""GitHub runner: only explicit external source failures are nonfatal."""
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import time
import urllib.error
import urllib.request
from dump_calendar import SourceUnavailableError, dump_calendar


def download(url, fetch=urllib.request.urlopen):
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with fetch(request, timeout=45) as response:
                return response.read()
        except (urllib.error.URLError, TimeoutError, ConnectionError) as error:
            if attempt == 2:
                raise SourceUnavailableError(f'SOURCE_UNAVAILABLE: {error}') from error
            time.sleep(attempt + 1)


def backend(url, secret):
    request = urllib.request.Request(url, data=b'{}', headers={'Content-Type': 'application/json', 'x-sync-secret': secret}, method='POST')
    with urllib.request.urlopen(request, timeout=180) as response:
        payload = json.loads(response.read())
    if not isinstance(payload, dict):
        raise RuntimeError('Invalid backend response')
    if payload.get('source_unavailable') is True and payload.get('success') is False:
        raise SourceUnavailableError(payload.get('error', 'Backend source unavailable'))
    if payload.get('success') is not True or payload.get('error'):
        raise RuntimeError(f'Backend did not complete successfully: {payload}')
    return payload


def calendar_source():
    with tempfile.TemporaryDirectory() as folder:
        texts = []
        for tid in ('205403', '205410'):
            path = Path(folder) / f'{tid}.xlsx'
            # Retry source parsing too, but never arbitrary Python failures.
            for attempt in range(3):
                try:
                    path.write_bytes(download(f'https://www.fotball.no/footballapi/Calendar/DownloadTournamentExcelCalendar?tournamentId={tid}'))
                    texts.append(dump_calendar(path).replace(str(path), tid))
                    break
                except SourceUnavailableError:
                    if attempt == 2:
                        raise
                    time.sleep(attempt + 1)
        return '\n'.join(texts)


def run(mode='sports', env=None, source=calendar_source, call=backend, fingerprint_file='fingerprint.txt'):
    env = os.environ if env is None else env
    try:
        url, secret = env.get('SUPABASE_PROJECT_URL'), env.get('MATCHES_SYNC_SECRET')
        if not url or not secret:
            raise RuntimeError('Missing backend URL or sync secret')
        if mode == 'grasrot':
            call(f'{url}/functions/v1/grasrot-scrape', secret)
            return 0
        content = source()
        new = hashlib.sha256(content.encode()).hexdigest()
        path = Path(fingerprint_file)
        old = path.read_text() if path.exists() else None
        if new == old and env.get('FORCE_SYNC') != 'true':
            print('Source unchanged; backend not called')
            return 0
        call(f'{url}/functions/v1/division-matches-sync', secret)
        call(f'{url}/functions/v1/standings-scraper', secret)
        # This is the only point where a new fingerprint is committed.
        path.write_text(new)
        if env.get('GITHUB_OUTPUT'):
            with open(env['GITHUB_OUTPUT'], 'a') as output:
                output.write('synced=true\n')
        return 0
    except SourceUnavailableError as error:
        text = str(error).replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')
        print(f'::warning::SOURCE_UNAVAILABLE: {text}. Existing data/fingerprint retained; next scheduled run retries.')
        return 0
    except Exception as error:
        print(f'Internal sync failure: {error}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(run(sys.argv[1] if len(sys.argv) > 1 else 'sports'))
