import { assertEquals } from 'jsr:@std/assert@1';
import { seasonEntries, dueDate, isSeasonComplete, seasonGoals, winnerIds } from './logic.ts';

const m = (o: Record<string, unknown>) => ({ competition: '5. div', status: 'finished', is_home: true, home_score: 2, away_score: 1, is_cancelled: false, match_date: '2026-10-01', ...o });
const st = (played: number) => [{ team_name: 'Fagerborg', played }, { team_name: 'X', played }, { team_name: 'Y', played }] as never;

Deno.test('goals count league and NM, not friendlies', () => {
  assertEquals(seasonGoals([m({}), m({ is_home: false, competition: 'NM' }), m({ competition: 'Treningskamp', home_score: 9 })] as never), 3);
});
Deno.test('season not complete while a league match is upcoming', () => {
  assertEquals(isSeasonComplete([m({}), m({ status: 'upcoming' })] as never, st(4)), false);
});
Deno.test('season complete when all rounds played (3 teams = 4 rounds)', () => {
  assertEquals(isSeasonComplete([m({}), m({ competition: 'Treningskamp', status: 'upcoming' })] as never, st(4)), true);
  assertEquals(isSeasonComplete([m({})] as never, st(3)), false);
});
Deno.test('closest guess wins, ties share', () => {
  assertEquals([...winnerIds([{ id: 'a', goal_guess: 70 }, { id: 'b', goal_guess: 74 }, { id: 'c', goal_guess: 80 }], 72)].sort(), ['a', 'b']);
});
Deno.test('due in 14 days', () => { assertEquals(dueDate(new Date('2026-11-01T12:00:00Z')), '2026-11-15'); });

Deno.test("2026 enrollment never enters 2027 invoices or winners",()=>{assertEquals(seasonEntries([{season:2026,id:"old"}],2027),[]);});
Deno.test("2027 enrollment only enters its own season",()=>{const e={season:2027,id:"new"};assertEquals(seasonEntries([e],2027),[e]);assertEquals(seasonEntries([e],2026),[]);});
