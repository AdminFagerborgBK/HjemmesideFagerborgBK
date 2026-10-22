"""GitHub-only discovery of the next league season from the stable fotball.no team pages.

The backend is contacted only when BOTH teams have exactly one validated league
candidate for the next season. fotball.no problems are warnings; internal/backend
problems are failures. NM/cup/qualification/friendlies are never league candidates.
"""
from datetime import datetime
import html
import json
import os
from pathlib import Path
import re
import sys
from zoneinfo import ZoneInfo
from dump_calendar import SourceUnavailableError
from sync import download, read_config

TEAM_IDS = {'A-laget': '311', 'B-laget': '6458'}
BASE = 'https://www.fotball.no'
LEAGUE = re.compile(r'^\d+\.\s*div(?:\.|isjon)\s', re.I)
EXCLUDED = re.compile(r'\b(nm|cup|kval|kvalifisering|trening|treningskamp|privat|sluttspill|playoff)\b', re.I)


class NotReady(Exception):
    """No complete, unambiguous discovery yet; keep existing configuration."""


def league_candidates(team_page):
    found = {}
    for tid, label in re.findall(r'href="/fotballdata/turnering/hjem/\?fiksId=(\d+)"\s*>([^<]+)<', team_page):
        label = html.unescape(label).strip()
        if LEAGUE.match(label) and not EXCLUDED.search(label):
            found[tid] = label
    return found


def parse_table(page, team_id, season):
    title = re.search(r'<title>\s*([^<]*?)\s+(\d{4})\s*-\s*Norges Fotballforbund', page)
    if not title or int(title.group(2)) != season:
        return None
    table = re.search(r'<table class="tablesorter[^"]*">(.*?)</table>', page, re.S)
    if not table:
        raise SourceUnavailableError('Tournament table missing')
    rows = re.findall(r'href="/fotballdata/lag/hjem/\?fiksId=(\d+)"\s*>([^<]*)<', table.group(1))
    teams = {fid: html.unescape(name).strip() for fid, name in rows}
    if len(teams) < 2:
        raise SourceUnavailableError('Tournament table empty or incomplete')
    if team_id not in teams or 'fagerborg' not in teams[team_id].lower():
        return None
    return {'league': html.unescape(title.group(1)).strip(), 'expected_teams': len(teams), 'club_name': teams[team_id]}


def discover(season, fetch=lambda url: download(url).decode('utf-8', 'replace')):
    teams = []
    for team, team_id in TEAM_IDS.items():
        valid = []
        for tid, _ in league_candidates(fetch(f'{BASE}/fotballdata/lag/hjem/?fiksId={team_id}')).items():
            info = parse_table(fetch(f'{BASE}/fotballdata/turnering/tabell/?fiksId={tid}'), team_id, season)
            if info:
                valid.append({'team': team, 'tournament_id': tid, 'team_id': team_id, **info})
        if len(valid) != 1:
            raise NotReady(f'{team}: {len(valid)} validated league candidates for {season}')
        if not 2 <= valid[0]['expected_teams'] <= 32:
            raise NotReady(f'{team}: implausible team count')
        teams.append(valid[0])
    return {'season': season, 'timezone': 'Europe/Oslo', 'teams': teams}


def post(url, secret, body):
    import urllib.request
    request = urllib.request.Request(url, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json', 'x-sync-secret': secret}, method='POST')
    with urllib.request.urlopen(request, timeout=180) as response:
        return json.loads(response.read())


def output(env, line):
    if env.get('GITHUB_OUTPUT'):
        with open(env['GITHUB_OUTPUT'], 'a') as f:
            f.write(line + '\n')


def run(env=None, now=None, fetch=None, call=post, manifest=read_config):
    env = os.environ if env is None else env
    now = now or datetime.now(ZoneInfo('Europe/Oslo'))
    try:
        target = manifest()['season'] + 1
        if now.year < target:
            print(f'Season {target - 1} is current; discovery is a no-op')
            return 0
        if env.get('FORCE_SYNC') != 'true' and now.astimezone(ZoneInfo('UTC')).hour >= 3:
            print('Discovery runs once daily; skipped')
            return 0
        config = discover(target, **({'fetch': fetch} if fetch else {}))
        url, secret = env.get('SUPABASE_PROJECT_URL'), env.get('MATCHES_SYNC_SECRET')
        if not url or not secret:
            raise RuntimeError('Missing backend URL or sync secret')
        result = call(f'{url}/functions/v1/sports-season-settings', secret, {'action': 'discover', 'config': config})
        if not isinstance(result, dict) or result.get('error'):
            raise RuntimeError(f'Discovery activation failed: {result}')
        if result.get('activated'):
            print(f'Activated discovered season {target}')
            output(env, 'activated=true')
        else:
            print(f'::warning::Discovery not applied: {result}')
        return 0
    except (SourceUnavailableError, NotReady) as error:
        print(f'::warning::SEASON_DISCOVERY: {error}. Existing configuration retained.')
        return 0
    except Exception as error:
        print(f'Internal discovery failure: {error}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(run())
