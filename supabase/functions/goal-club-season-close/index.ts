import { createClient } from 'npm:@supabase/supabase-js@2.112.4';
import { readSportsSeason, teamConfig } from '../_shared/sportsSeason.ts';
import { osloWallTimeToIso } from '../_shared/osloWallTime.mjs';
import { htmlEscape, requireAdminOrSecret } from '../_shared/adminAuth.ts';
import { ACCOUNT_NUMBER, dueDate, invoiceReference, isSeasonComplete, seasonGoals, winnerIds } from './logic.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-secret' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
const kr = (n: number) => n.toLocaleString('nb-NO');
const nbDate = (iso: string) => iso.split('-').reverse().join('.');

interface Fb { position: number; league: string; points: number; won: number; drawn: number; lost: number; goals_for: number; goals_against: number }
interface Inv { name: string; amount_per_goal: number; total_nok: number; reference: string; due_date: string; is_winner: boolean }

const subjectFor = (season: number, total: number) => `Målklubben ${season}: sesongoppsummering og faktura (${kr(total)} kr)`;

function renderInvoice(season: number, goals: number, fb: Fb, inv: Inv, guess: number | null | undefined) {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
<h1 style="color:#1a365d;font-size:22px">Målklubben ${season} – takk for sesongen! ⚽</h1>
<p>Hei ${htmlEscape(inv.name)},</p>
<p>Sesongen ${season} er ferdigspilt for A-laget. Vi endte på <strong>${fb.position}. plass</strong> i ${htmlEscape(fb.league)} med ${fb.points} poeng (${fb.won} seire, ${fb.drawn} uavgjort, ${fb.lost} tap) og målforskjell ${fb.goals_for}–${fb.goals_against}.</p>
<p>Totalt scoret Fagerborg <strong>${goals} mål</strong> i serie og NM. Takk for at du var med og heiet på hver eneste scoring!</p>
${inv.is_winner ? `<p style="background:#fef3c7;padding:12px;border-radius:8px">🏆 <strong>Gratulerer – du vant måltipset!</strong> Du tippet ${guess} mål, som var nærmest. Vi tar kontakt om premien.</p>` : ''}
<h2 style="color:#1a365d;font-size:18px">Faktura</h2>
<table style="border-collapse:collapse;width:100%">
<tr><td style="padding:8px;border:1px solid #e2e8f0">Beløp per mål</td><td style="padding:8px;border:1px solid #e2e8f0">${kr(inv.amount_per_goal)} kr</td></tr>
<tr><td style="padding:8px;border:1px solid #e2e8f0">Antall mål</td><td style="padding:8px;border:1px solid #e2e8f0">${goals}</td></tr>
${guess != null ? `<tr><td style="padding:8px;border:1px solid #e2e8f0">Ditt måltips</td><td style="padding:8px;border:1px solid #e2e8f0">${guess} mål</td></tr>` : ''}
<tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:bold">Å betale</td><td style="padding:8px;border:1px solid #e2e8f0;font-weight:bold">${kr(inv.total_nok)} kr</td></tr>
<tr><td style="padding:8px;border:1px solid #e2e8f0">Kontonummer</td><td style="padding:8px;border:1px solid #e2e8f0">${ACCOUNT_NUMBER}</td></tr>
<tr><td style="padding:8px;border:1px solid #e2e8f0">Melding til mottaker</td><td style="padding:8px;border:1px solid #e2e8f0"><strong>${inv.reference}</strong></td></tr>
<tr><td style="padding:8px;border:1px solid #e2e8f0">Forfall</td><td style="padding:8px;border:1px solid #e2e8f0">${nbDate(inv.due_date)}</td></tr>
</table>
<p style="font-size:13px;color:#64748b">Husk å skrive referansen i meldingsfeltet så vi finner betalingen din. Spørsmål? Svar på denne e-posten eller skriv til post@fagerborgbk.no.</p>
<p>Med vennlig hilsen,<br/><strong>Fagerborg BK</strong></p></div>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const denied = await requireAdminOrSecret(req);
  if (denied) return denied;
  try {
  const url=Deno.env.get('SUPABASE_URL'), service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !service) return json({error:'Tjenesten er ikke konfigurert'},500);
  const db = createClient(url, service);
  const reqBody = await req.json().catch(() => ({}));
  if (reqBody.season !== undefined && (!Number.isInteger(reqBody.season) || reqBody.season<2000 || reqBody.season>2200)) return json({error:'Ugyldig sesong'},400);
  const config=await readSportsSeason(db,reqBody.season);
  const season=config.season, a=teamConfig(config,'A-laget');
  const preview = reqBody?.preview === true;

  const { data: existing } = await db.from('goal_club_season_closures').select('status').eq('season', season).maybeSingle();
  if (!preview && existing?.status === 'completed') return json({ status: 'already_sent', season });

  const [{ data: matches, error: mErr }, { data: standings, error: sErr }] = await Promise.all([
    db.from('matches').select('competition,status,is_home,home_score,away_score,is_cancelled,match_date').eq('team', 'A-laget')
      .gte('match_date', osloWallTimeToIso(`${season}-01-01`,'00:00')).lt('match_date', osloWallTimeToIso(`${season + 1}-01-01`,'00:00')),
    db.from('standings').select('team_name,played,position,points,won,drawn,lost,goals_for,goals_against,league').eq('team', 'A-laget').eq('season', String(season)),
  ]);
  if (mErr || sErr) return json({ error: 'Kunne ikke lese kamper/tabell' }, 500);
  const complete = isSeasonComplete(matches ?? [], standings ?? [], a.expected_teams, a.club_name);

  // Preview: read-only, no writes and no e-mail.
  if (preview) {
    const goals = seasonGoals(matches ?? []);
    const fb: Fb = (standings ?? []).find((s) => s.team_name === a.club_name) ?? { position: 0, league: '–', points: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0 };
    const { data: ents } = await db.from('goal_club_entries').select('id,name,email,amount_per_goal,goal_guess').eq('season',season).is('deleted_at', null).order('name');
    const list = ents ?? [];
    const e = list.find((x) => x.id === reqBody?.entry_id) ?? list[0]
      ?? { id: '00000000-0000-0000-0000-000000000000', name: 'Eksempel Medlem', email: 'eksempel@fagerborgbk.no', amount_per_goal: 10, goal_guess: 50 };
    const inv: Inv = { name: e.name, amount_per_goal: e.amount_per_goal, total_nok: e.amount_per_goal * goals, reference: invoiceReference(season, e.id), due_date: dueDate(new Date()), is_winner: winnerIds(list, goals).has(e.id) };
    return json({
      preview: true, season, complete, goals, entry_id: e.id,
      entries: list.map((x) => ({ id: x.id, name: x.name })),
      to: e.email, subject: subjectFor(season, inv.total_nok), html: renderInvoice(season, goals, fb, inv, e.goal_guess),
    });
  }
  // Test send: simulates season end using current data, mails ONLY the given test address, writes nothing.
  const t = reqBody?.test_send;
  if (t && typeof t.email === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t.email)) {
    const goals = seasonGoals(matches ?? []);
    const fb: Fb = (standings ?? []).find((s) => s.team_name === a.club_name) ?? { position: 0, league: '–', points: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0 };
    const apg = Math.max(1, Math.min(10000, Number(t.amount_per_goal) || 10));
    const guess = Math.max(0, Math.min(999, Number(t.goal_guess) || 0));
    const testId = crypto.randomUUID();
    const inv: Inv = { name: String(t.name ?? 'Testmedlem').slice(0, 100), amount_per_goal: apg, total_nok: apg * goals, reference: `TEST-${invoiceReference(season, testId)}`, due_date: dueDate(new Date()), is_winner: false };
    const key = Deno.env.get('RESEND_API_KEY');
    if (!key) return json({ error: 'RESEND_API_KEY mangler' }, 500);
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Fagerborg BK <post@support.fagerborgbk.no>', reply_to: 'post@fagerborgbk.no', to: [t.email], subject: `[TEST] ${subjectFor(season, inv.total_nok)}`, html: renderInvoice(season, goals, fb, inv, guess) }),
    });
    const body = await r.json().catch(() => ({}));
    return json({ test: true, season, complete, goals, total_nok: inv.total_nok, position: fb.position, sent: r.ok, email_id: body?.id ?? null, error: r.ok ? null : body }, r.ok ? 200 : 502);
  }
  if (!complete) return json({ status: 'season_not_finished', season });

  const goals = seasonGoals(matches ?? []);
  const fb = standings?.find((s) => s.team_name === a.club_name);
  if (!fb) return json({error:'Klubbens tabellrad mangler'},500);
  await db.from('goal_club_season_closures').upsert({ season, goals, final_position: fb.position, league: fb.league }, { onConflict: 'season', ignoreDuplicates: true });

  const { data: entries } = await db.from('goal_club_entries').select('id,name,email,amount_per_goal,goal_guess').eq('season',season).is('deleted_at', null);
  const winners = winnerIds(entries ?? [], goals);
  const due = dueDate(new Date());
  if (entries?.length) {
    await db.from('goal_club_invoices').upsert(entries.map((e) => ({
      season, entry_id: e.id, email: e.email, name: e.name, amount_per_goal: e.amount_per_goal, goals,
      total_nok: e.amount_per_goal * goals, reference: invoiceReference(season, e.id), due_date: due, is_winner: winners.has(e.id),
    })), { onConflict: 'season,entry_id', ignoreDuplicates: true });
  }

  const key = Deno.env.get('RESEND_API_KEY');
  const { data: pending } = await db.from('goal_club_invoices').select('*').eq('season', season).neq('email_state', 'sent');
  const guesses = new Map((entries ?? []).map((e) => [e.id, e.goal_guess]));
  let sent = 0, failed = 0;
  for (const inv of pending ?? []) {
    const html = renderInvoice(season, goals, fb, inv, guesses.get(inv.entry_id));
    let ok = false, id: string | null = null, err: string | null = null;
    if (!key) err = 'RESEND_API_KEY mangler';
    else {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `goal-club-invoice-${inv.id}` },
        body: JSON.stringify({ from: 'Fagerborg BK <post@support.fagerborgbk.no>', reply_to: 'post@fagerborgbk.no', to: [inv.email], subject: subjectFor(season, inv.total_nok), html }),
      });
      const body = await r.json().catch(() => ({}));
      ok = r.ok; id = body?.id ?? null; err = r.ok ? null : JSON.stringify(body).slice(0, 300);
    }
    await db.from('goal_club_invoices').update(ok ? { email_state: 'sent', email_id: id, sent_at: new Date().toISOString(), email_error: null } : { email_state: 'failed', email_error: err }).eq('id', inv.id);
    ok ? sent++ : failed++;
  }
  const { count } = await db.from('goal_club_invoices').select('id', { count: 'exact', head: true }).eq('season', season).eq('email_state', 'sent');
  await db.from('goal_club_season_closures').update({ sent_count: count ?? 0, failed_count: failed, ...(failed === 0 ? { status: 'completed', completed_at: new Date().toISOString() } : { status: 'partial' }) }).eq('season', season);
  return json({ status: failed ? 'partial' : 'completed', season, goals, sent, failed }, failed ? 502 : 200);
  } catch (error) { return json({error:error instanceof Error?error.message:'Uventet intern feil'},500); }
});
