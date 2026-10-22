import { supabase } from '@/integrations/supabase/client';

interface ManualData {
  newsCount: number;
  videoCount: number;
  newsletterCount: number;
  memberCount: number;
  matchCount: number;
  sponsorCount: number;
  activeSponsors: string[];
  features: Record<string, boolean>;
  menuItems: string[];
}

async function fetchManualData(): Promise<ManualData> {
  const [
    { data: newsData },
    { data: videoData },
    { data: newsletterData },
    { data: memberData },
    { data: matchData },
    { data: sponsors },
    { data: settings },
  ] = await Promise.all([
    supabase.from('news').select('id').eq('is_published', true),
    supabase.from('site_videos').select('id').eq('status', 'published'),
    supabase.from('newsletters').select('id'),
    supabase.from('memberships').select('id'),
    supabase.from('matches').select('id'),
    supabase.from('site_sponsors').select('name, is_active, tier'),
    supabase.from('site_settings').select('key, value'),
  ]);

  const newsCount = newsData?.length ?? 0;
  const videoCount = videoData?.length ?? 0;
  const newsletterCount = newsletterData?.length ?? 0;
  const memberCount = memberData?.length ?? 0;
  const matchCount = matchData?.length ?? 0;

  const features: Record<string, boolean> = {};
  settings?.forEach((s: any) => {
    if (typeof s.value === 'boolean') features[s.key] = s.value;
    else if (s.value === true || s.value === 'true') features[s.key] = true;
    else if (s.value === false || s.value === 'false') features[s.key] = false;
  });

  const activeSponsors = sponsors?.filter((s: any) => s.is_active).map((s: any) => s.name) || [];

  // Build menu items based on active features
  const menuItems = ['Oversikt', 'Nyheter', 'Videoer', 'Kamper'];
  if (features['livestream_enabled']) menuItems.push('Direktesending');
  menuItems.push('Spillerstall', 'Medlemmer', 'Styret', 'Tabellhistorikk', 'Sider');
  if (features['sponsors_enabled']) menuItems.push('Sponsorer');
  menuItems.push('Personvern', 'Nyhetsbrev', 'Innstillinger', 'Admins');

  return {
    newsCount: newsCount || 0,
    videoCount: videoCount || 0,
    newsletterCount: newsletterCount || 0,
    memberCount: memberCount || 0,
    matchCount: matchCount || 0,
    sponsorCount: sponsors?.length || 0,
    activeSponsors,
    features,
    menuItems,
  };
}

/**
 * Generates a comprehensive Norwegian user manual as an HTML file
 * with accurate reproductions of the admin panel UI and annotated screenshots.
 * Data is fetched live from the database so the manual is always up-to-date.
 */
export async function downloadManual() {
  const data = await fetchManualData();
  const html = `<!DOCTYPE html>
<html lang="no">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Brukermanual – Fagerborg BK Nettside</title>
<style>
  @media print { .no-print { display: none; } body { font-size: 11pt; } .page-break { page-break-before: always; } }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; line-height: 1.7; color: #1a1a1a; max-width: 860px; margin: 0 auto; padding: 40px 24px; background: #fafbfc; }
  h1 { font-size: 28px; margin-bottom: 8px; color: #1a2744; border-bottom: 3px solid #1a2744; padding-bottom: 12px; }
  h2 { font-size: 22px; margin-top: 40px; margin-bottom: 12px; color: #1a2744; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
  h3 { font-size: 17px; margin-top: 24px; margin-bottom: 8px; color: #2d4a6d; }
  p, li { margin-bottom: 8px; }
  ul, ol { padding-left: 24px; margin-bottom: 16px; }
  .subtitle { color: #666; font-size: 14px; margin-bottom: 32px; }
  .tip { background: #f0f7f3; border-left: 4px solid #2a6e3f; padding: 12px 16px; margin: 16px 0; border-radius: 0 6px 6px 0; }
  .tip strong { color: #1a472a; }
  .warning { background: #fef3cd; border-left: 4px solid #e6a817; padding: 12px 16px; margin: 16px 0; border-radius: 0 6px 6px 0; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
  th { background: #f5f5f5; font-weight: 600; }
  code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-size: 13px; }
  .toc { background: #f9f9f9; padding: 20px 24px; border-radius: 8px; margin-bottom: 32px; border: 1px solid #e0e0e0; }
  .toc a { color: #1a2744; text-decoration: none; }
  .toc a:hover { text-decoration: underline; }
  .toc ol { padding-left: 20px; }
  .toc li { margin-bottom: 4px; }
  .print-btn { position: fixed; bottom: 20px; right: 20px; background: #1a2744; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); z-index: 100; }
  .print-btn:hover { background: #2d4a6d; }

  /* ===== ADMIN PANEL REPRODUCTION STYLES ===== */
  .admin-screenshot {
    background: #eef2f7;
    border: 2px solid #d0d5dd;
    border-radius: 12px;
    overflow: hidden;
    margin: 20px 0;
    box-shadow: 0 4px 16px rgba(0,0,0,0.08);
    position: relative;
    font-size: 13px;
  }
  .admin-screenshot .browser-bar {
    background: #e8ecf1;
    padding: 6px 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    border-bottom: 1px solid #d0d5dd;
  }
  .admin-screenshot .browser-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  .admin-screenshot .browser-dot.red { background: #ff5f57; }
  .admin-screenshot .browser-dot.yellow { background: #ffbd2e; }
  .admin-screenshot .browser-dot.green { background: #28c840; }
  .admin-screenshot .browser-url {
    background: white;
    padding: 3px 12px;
    border-radius: 4px;
    font-size: 11px;
    color: #666;
    margin-left: 8px;
    flex: 1;
  }
  .admin-layout {
    display: flex;
    min-height: 400px;
  }
  /* Sidebar - matches real admin panel */
  .admin-sidebar {
    background: #1a2744;
    color: white;
    width: 200px;
    flex-shrink: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  .admin-sidebar-header {
    padding: 16px 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .admin-sidebar-logo {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #2d5a3d;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    border: 2px solid #e6c94a;
  }
  .admin-sidebar-title {
    font-weight: 700;
    font-size: 14px;
    line-height: 1.2;
  }
  .admin-sidebar-subtitle {
    font-size: 11px;
    opacity: 0.6;
  }
  .admin-nav { padding: 8px 6px; flex: 1; }
  .admin-nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
    color: rgba(255,255,255,0.7);
    margin-bottom: 1px;
    cursor: default;
  }
  .admin-nav-item.active {
    background: rgba(255,255,255,0.12);
    color: white;
    font-weight: 600;
  }
  .admin-nav-item .nav-icon { width: 18px; text-align: center; font-size: 14px; }
  .admin-nav-bottom {
    padding: 8px 6px;
    border-top: 1px solid rgba(255,255,255,0.08);
    margin-top: auto;
  }
  /* Main content area */
  .admin-main {
    flex: 1;
    padding: 24px;
    background: #eef2f7;
    position: relative;
  }
  .admin-page-title {
    font-size: 22px;
    font-weight: 700;
    color: #1a2744;
    margin-bottom: 4px;
  }
  .admin-page-subtitle {
    font-size: 13px;
    color: #6b7280;
    margin-bottom: 20px;
  }
  /* Cards that match the real admin */
  .admin-card {
    background: white;
    border-radius: 10px;
    border: 1px solid #e5e7eb;
    padding: 16px;
    margin-bottom: 12px;
  }
  .admin-stat-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 16px;
  }
  .admin-stat-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 16px;
    position: relative;
  }
  .admin-stat-label { font-size: 12px; color: #6b7280; }
  .admin-stat-value { font-size: 28px; font-weight: 700; color: #1a2744; margin: 4px 0; }
  .admin-stat-detail { font-size: 11px; color: #9ca3af; }
  .admin-stat-icon {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
  }
  /* Table styles matching admin */
  .admin-table { width: 100%; border-collapse: collapse; }
  .admin-table th {
    text-align: left;
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
    padding: 10px 12px;
    border-bottom: 1px solid #e5e7eb;
    background: transparent;
  }
  .admin-table td {
    padding: 12px;
    border-bottom: 1px solid #f3f4f6;
    font-size: 13px;
    color: #374151;
    border: none;
  }
  /* Buttons matching admin */
  .admin-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: default;
  }
  .admin-btn-primary { background: #1a2744; color: white; }
  .admin-btn-yellow { background: #e6c94a; color: #1a2744; }
  .admin-btn-outline { background: white; color: #1a2744; border: 1px solid #d1d5db; }
  /* Badge styles */
  .admin-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
  }
  .admin-badge-green { background: #dcfce7; color: #166534; }
  .admin-badge-yellow { background: #fef3c7; color: #92400e; }
  .admin-badge-blue { background: #dbeafe; color: #1e40af; }
  .admin-badge-red { background: #fecaca; color: #991b1b; }
  .admin-badge-gray { background: #f3f4f6; color: #4b5563; }
  /* Toggle switch */
  .admin-toggle {
    width: 38px;
    height: 22px;
    border-radius: 11px;
    position: relative;
    display: inline-block;
  }
  .admin-toggle.on { background: #1a2744; }
  .admin-toggle.off { background: #d1d5db; }
  .admin-toggle .toggle-knob {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: white;
    position: absolute;
    top: 2px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.2);
  }
  .admin-toggle.on .toggle-knob { right: 2px; }
  .admin-toggle.off .toggle-knob { left: 2px; }
  /* Input */
  .admin-input {
    border: 1px solid #d1d5db;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 13px;
    display: block;
    width: 100%;
    margin: 4px 0;
    background: white;
    color: #374151;
  }

  /* ===== RED ANNOTATION STYLES ===== */
  .annotation-box {
    border: 3px solid #ef4444;
    border-radius: 8px;
    position: absolute;
    pointer-events: none;
    z-index: 10;
  }
  .annotation-circle {
    border: 3px solid #ef4444;
    border-radius: 50%;
    position: absolute;
    pointer-events: none;
    z-index: 10;
  }
  .annotation-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: #ef4444;
    color: white;
    font-size: 13px;
    font-weight: 700;
    position: absolute;
    z-index: 11;
    box-shadow: 0 2px 4px rgba(239,68,68,0.4);
  }
  /* Relative annotation wrapper */
  .annotated-area {
    position: relative;
    border: 3px solid #ef4444;
    border-radius: 8px;
    padding: 4px;
    margin: 2px;
  }
  .annotated-area::before {
    content: attr(data-label);
    position: absolute;
    top: -12px;
    left: 8px;
    background: #ef4444;
    color: white;
    font-size: 11px;
    font-weight: 700;
    padding: 1px 8px;
    border-radius: 4px;
    z-index: 5;
  }
  .inline-annotation {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 2px solid #ef4444;
    border-radius: 6px;
    padding: 2px 6px;
    position: relative;
  }
  .inline-annotation::after {
    content: attr(data-num);
    background: #ef4444;
    color: white;
    font-size: 10px;
    font-weight: 700;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: 4px;
  }
  .red-callout {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #ef4444;
    color: white;
    font-size: 12px;
    font-weight: 700;
    margin-right: 8px;
    flex-shrink: 0;
  }
  .annotated-step-red {
    display: flex;
    align-items: flex-start;
    margin: 10px 0;
    padding: 12px 16px;
    background: #fef2f2;
    border-left: 4px solid #ef4444;
    border-radius: 0 8px 8px 0;
  }
  .annotated-step-red p { margin: 0; }
  .diagram-caption {
    font-size: 12px;
    color: #6b7280;
    text-align: center;
    margin-top: 8px;
    font-style: italic;
  }

  /* Step flow */
  .step-flow { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; margin: 12px 0; }
  .step-box { background: white; border: 2px solid #1a2744; border-radius: 8px; padding: 8px 14px; font-size: 12px; font-weight: 600; color: #1a2744; }
  .step-box.highlight { background: #1a2744; color: white; }
  .arrow { display: inline-block; margin: 0 8px; color: #666; font-size: 18px; }

  /* Legacy annotated step */
  .callout-number { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background: #1a2744; color: white; font-size: 12px; font-weight: 700; margin-right: 8px; flex-shrink: 0; }
  .annotated-step { display: flex; align-items: flex-start; margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 8px; }
  .annotated-step p { margin: 0; }

  .section-intro { font-size: 14px; color: #4b5563; margin-bottom: 16px; line-height: 1.6; }
</style>
</head>
<body>

<button class="print-btn no-print" onclick="window.print()">🖨️ Skriv ut / Lagre som PDF</button>

<h1>📘 Brukermanual</h1>
<p class="subtitle">Fagerborg BK – Administrasjon og nettside<br>Sist oppdatert: ${new Date().toLocaleDateString('nb-NO', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

<div style="background: #dbeafe; border: 1px solid #93c5fd; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
  <strong style="color: #1e40af;">📊 Sanntidsdata fra databasen</strong>
  <p style="font-size: 13px; color: #1e3a5f; margin: 8px 0 0;">
    Denne manualen ble generert med oppdaterte tall: 
    <strong>${data.newsCount}</strong> nyhetsartikler · 
    <strong>${data.videoCount}</strong> videoer · 
    <strong>${data.newsletterCount}</strong> nyhetsbrev · 
    <strong>${data.memberCount}</strong> medlemmer · 
    <strong>${data.matchCount}</strong> kamper · 
    <strong>${data.sponsorCount}</strong> sponsorer${data.activeSponsors.length > 0 ? ' (aktive: ' + data.activeSponsors.join(', ') + ')' : ''}.
    Funksjons-toggles og menypunkter reflekterer gjeldende innstillinger.
  </p>
</div>

<div class="toc">
<strong>📋 Innholdsfortegnelse</strong>
<ol>
  <li><a href="#innlogging">Innlogging</a></li>
  <li><a href="#navigasjon">Navigasjon i admin-panelet</a></li>
  <li><a href="#oversikt">Oversikt (Dashboard)</a></li>
  <li><a href="#nyheter">Nyheter</a></li>
  <li><a href="#videoer">Videoer</a></li>
  <li><a href="#kamper">Kamper og kampgrafikk</a></li>
  <li><a href="#medlemmer">Medlemmer og kontingent</a></li>
  <li><a href="#styret">Styret</a></li>
  <li><a href="#tabellhistorikk">Tabellhistorikk</a></li>
  <li><a href="#sider">Sider</a></li>
  <li><a href="#sponsorer">Sponsorer</a></li>
  <li><a href="#personvern">Personvern (GDPR)</a></li>
  <li><a href="#nyhetsbrev">Nyhetsbrev</a></li>
  <li><a href="#innstillinger">Innstillinger</a></li>
  <li><a href="#admins">Administratorer</a></li>
  <li><a href="#offentlig">Offentlig nettside</a></li>
</ol>
</div>

<!-- ============ 1. INNLOGGING ============ -->
<h2 id="innlogging">1. 🔐 Innlogging</h2>
<p class="section-intro">For å få tilgang til administrasjonspanelet må du logge inn med din admin-konto. Kun godkjente administratorer kan logge inn.</p>

<div class="admin-screenshot">
  <div class="browser-bar">
    <span class="browser-dot red"></span>
    <span class="browser-dot yellow"></span>
    <span class="browser-dot green"></span>
    <span class="browser-url">fagerborgbk.no/auth</span>
  </div>
  <div style="background: #eef2f7; padding: 40px; display: flex; justify-content: center;">
    <div style="background: white; border-radius: 12px; padding: 32px; width: 380px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); text-align: center;">
      <div style="width: 60px; height: 60px; background: #1a2744; border-radius: 50%; margin: 0 auto 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; border: 2px solid #e6c94a;">⚽</div>
      <div style="font-weight: 700; font-size: 18px; color: #1a2744; margin-bottom: 4px;">Fagerborg BK</div>
      <div style="font-size: 13px; color: #6b7280; margin-bottom: 24px;">Admin-innlogging</div>
      <div style="text-align: left; margin-bottom: 12px;">
        <label style="font-size: 12px; font-weight: 600; color: #374151;">E-post</label>
        <div class="annotated-area" data-label="1">
          <div class="admin-input">admin@fagerborgbk.no</div>
        </div>
      </div>
      <div style="text-align: left; margin-bottom: 16px;">
        <label style="font-size: 12px; font-weight: 600; color: #374151;">Passord</label>
        <div class="annotated-area" data-label="2">
          <div class="admin-input">••••••••</div>
        </div>
      </div>
      <div class="annotated-area" data-label="3" style="margin-bottom: 12px;">
        <div class="admin-btn admin-btn-primary" style="width: 100%; justify-content: center; padding: 12px;">Logg inn</div>
      </div>
      <div style="font-size: 12px; color: #2a6e3f; margin-top: 12px;">Glemt passord?</div>
    </div>
  </div>
</div>
<p class="diagram-caption">Innloggingsskjermen slik den ser ut i nettleseren. Røde markeringer viser steg 1–3.</p>

<div class="annotated-step-red">
  <span class="red-callout">1</span>
  <p>Skriv inn <strong>e-postadressen</strong> din i feltet merket «E-post». Dette må være den e-posten som er registrert som admin.</p>
</div>
<div class="annotated-step-red">
  <span class="red-callout">2</span>
  <p>Skriv inn <strong>passordet</strong> ditt. Kontakt Superadmin om du ikke har fått passord.</p>
</div>
<div class="annotated-step-red">
  <span class="red-callout">3</span>
  <p>Klikk <strong>«Logg inn»</strong>-knappen. Du sendes automatisk til admin-dashboardet (Oversikt).</p>
</div>

<div class="tip"><strong>💡 Glemt passord?</strong> Klikk «Glemt passord»-lenken under innloggingsknappen. Du mottar en e-post med lenke for å opprette nytt passord. Sjekk søppelpost om du ikke finner e-posten.</div>

<!-- ============ 2. NAVIGASJON ============ -->
<h2 id="navigasjon" class="page-break">2. 🧭 Navigasjon i admin-panelet</h2>
<p class="section-intro">Admin-panelet har et fast mørkeblått sidefelt (sidebar) til venstre med alle tilgjengelige menyer. Sidefeltet er alltid synlig på desktop og fungerer som hovednavigasjon.</p>

<div class="admin-screenshot">
  <div class="browser-bar">
    <span class="browser-dot red"></span>
    <span class="browser-dot yellow"></span>
    <span class="browser-dot green"></span>
    <span class="browser-url">fagerborgbk.no/admin</span>
  </div>
  <div class="admin-layout">
    <div class="admin-sidebar">
      <div class="admin-sidebar-header">
        <div class="admin-sidebar-logo">⚽</div>
        <div>
          <div class="admin-sidebar-title">Fagerborg BK</div>
          <div class="admin-sidebar-subtitle">Admin</div>
        </div>
      </div>
      <div class="admin-nav">
        <div class="annotated-area" data-label="Meny" style="border-color: #ef4444; margin: 4px;">
          ${data.menuItems.map((item, i) => {
            const icons: Record<string, string> = { Oversikt: '📊', Nyheter: '📰', Videoer: '🎬', Kamper: '📅', Direktesending: '📡', Spillerstall: '👥', Medlemmer: '🧑‍💼', Styret: '🏅', Tabellhistorikk: '📈', Sider: '📄', Sponsorer: '⭐', Personvern: '🛡️', Nyhetsbrev: '📧', Innstillinger: '⚙️', Admins: '👤' };
            return `<div class="admin-nav-item${i === 0 ? ' active' : ''}"><span class="nav-icon">${icons[item] || '📋'}</span> ${item}</div>`;
          }).join('\n          ')}
        </div>
      </div>
      <div class="admin-nav-bottom">
        <div class="admin-nav-item"><span class="nav-icon">🏠</span> Gå til forsiden</div>
        <div class="admin-nav-item"><span class="nav-icon">🚪</span> Logg ut</div>
        <div style="padding: 8px 12px; font-size: 11px; opacity: 0.5;">admin@fagerborgbk.no</div>
      </div>
    </div>
    <div class="admin-main">
      <div class="admin-page-title">Oversikt</div>
      <div class="admin-page-subtitle">Velkommen til administrasjonspanelet</div>
      <div class="admin-stat-grid">
        <div class="admin-stat-card">
          <div class="admin-stat-label">Nyheter</div>
          <div class="admin-stat-value">${data.newsCount}</div>
          <div class="admin-stat-detail">${data.newsCount} publisert / aktiv</div>
          <div class="admin-stat-icon" style="background: #dbeafe;">📰</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-label">Videoer</div>
          <div class="admin-stat-value">${data.videoCount}</div>
          <div class="admin-stat-detail">${data.videoCount} publisert / aktiv</div>
          <div class="admin-stat-icon" style="background: #e0e7ff;">🎬</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-label">Nyhetsbrev</div>
          <div class="admin-stat-value">${data.newsletterCount}</div>
          <div class="admin-stat-detail">${data.newsletterCount} publisert / aktiv</div>
          <div class="admin-stat-icon" style="background: #fef3c7;">📧</div>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div class="admin-card" style="border-left: 3px solid #e6c94a;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <span style="font-size: 18px;">⚡</span>
            <div><strong>Hurtiglenker</strong><br><span style="font-size: 11px; color: #6b7280;">Kom raskt i gang</span></div>
          </div>
          <div style="font-size: 13px; line-height: 2;">
            📝 Opprett nytt innlegg<br>
            🎬 Legg til video<br>
            👥 Legg til person<br>
            📄 Rediger sider
          </div>
        </div>
        <div class="admin-card" style="border-left: 3px solid #1a2744;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <span style="font-size: 18px;">📘</span>
            <div><strong>Brukermanual</strong><br><span style="font-size: 11px; color: #6b7280;">Komplett guide til admin-panelet</span></div>
          </div>
          <div class="admin-btn admin-btn-primary" style="width: 100%; justify-content: center;">📥 Last ned brukermanual (HTML)</div>
        </div>
      </div>
    </div>
  </div>
</div>
<p class="diagram-caption">Nøyaktig gjengivelse av admin-panelet med sidebar og dashboard. Den røde markeringen viser navigasjonsmenyen.</p>

<div class="annotated-step-red">
  <span class="red-callout">!</span>
  <p><strong>Sidebar-navigasjon:</strong> Det mørkeblå sidefeltet til venstre inneholder alle menypunkter. Klikk på ønsket menypunkt for å navigere til den seksjonen. Det aktive menypunktet er markert med lysere bakgrunn.</p>
</div>

<table>
  <tr><th>Menypunkt</th><th>Funksjon</th></tr>
  <tr><td>📊 Oversikt</td><td>Dashboard med nøkkeltall, hurtiglenker og brukermanual</td></tr>
  <tr><td>📰 Nyheter</td><td>Opprett, rediger og publiser nyhetsartikler</td></tr>
  <tr><td>🎬 Videoer</td><td>Administrer videoinnhold (YouTube, Hudl)</td></tr>
  <tr><td>📅 Kamper</td><td>Se og rediger kamper, generer kampgrafikk</td></tr>
  <tr><td>📡 Direktesending</td><td>Administrer livestream-statistikk</td></tr>
  <tr><td>👥 Spillerstall</td><td>Administrer spillerprofiler for A- og B-laget</td></tr>
  <tr><td>🧑‍💼 Medlemmer</td><td>Medlemsliste, kontingent-e-post</td></tr>
  <tr><td>⭐ Sponsorer</td><td>Administrer hovedsponsor og partnere</td></tr>
  <tr><td>⚙️ Innstillinger</td><td>Funksjons-toggles, Facebook/TikTok-integrasjon</td></tr>
  <tr><td>👤 Admins</td><td>Administrer admin-brukere (kun Superadmin)</td></tr>
</table>

<div class="tip"><strong>📱 Mobil:</strong> På mobil skjules sidefeltet. Trykk ☰-knappen øverst til venstre for å åpne navigasjonsmenyen.</div>

<!-- ============ 3. OVERSIKT ============ -->
<h2 id="oversikt">3. 📊 Oversikt (Dashboard)</h2>
<p class="section-intro">Dashboardet gir deg en rask oppsummering med nøkkeltall for hele nettsiden. Her ser du antall nyheter, videoer og nyhetsbrev, samt hurtiglenker til vanlige oppgaver.</p>

<div class="admin-screenshot">
  <div class="browser-bar">
    <span class="browser-dot red"></span>
    <span class="browser-dot yellow"></span>
    <span class="browser-dot green"></span>
    <span class="browser-url">fagerborgbk.no/admin</span>
  </div>
  <div style="background: #eef2f7; padding: 24px;">
    <div class="admin-page-title">Oversikt</div>
    <div class="admin-page-subtitle">Velkommen til administrasjonspanelet</div>
    <div class="admin-stat-grid">
      <div class="admin-stat-card annotated-area" data-label="A">
        <div class="admin-stat-label">Nyheter</div>
        <div class="admin-stat-value">${data.newsCount}</div>
        <div class="admin-stat-detail">${data.newsCount} publisert / aktiv</div>
        <div class="admin-stat-icon" style="background: #dbeafe;">📰</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-label">Videoer</div>
        <div class="admin-stat-value">${data.videoCount}</div>
        <div class="admin-stat-detail">${data.videoCount} publisert / aktiv</div>
        <div class="admin-stat-icon" style="background: #e0e7ff;">🎬</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-label">Nyhetsbrev</div>
        <div class="admin-stat-value">${data.newsletterCount}</div>
        <div class="admin-stat-detail">${data.newsletterCount} publisert / aktiv</div>
        <div class="admin-stat-icon" style="background: #fef3c7;">📧</div>
      </div>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
      <div class="admin-card annotated-area" data-label="B" style="border-left: 3px solid #e6c94a;">
        <strong>⚡ Hurtiglenker</strong>
        <div style="font-size: 13px; line-height: 2; margin-top: 8px;">
          📝 Opprett nytt innlegg<br>
          🎬 Legg til video<br>
          👥 Legg til person<br>
          📄 Rediger sider
        </div>
      </div>
      <div class="admin-card annotated-area" data-label="C" style="border-left: 3px solid #1a2744;">
        <strong>📘 Brukermanual</strong>
        <p style="font-size: 12px; color: #6b7280; margin: 8px 0;">Illustrert manual med guider for alle funksjoner – fra publisering til kampstyring.</p>
        <div class="admin-btn admin-btn-primary" style="width: 100%; justify-content: center;">📥 Last ned brukermanual (HTML)</div>
      </div>
    </div>
  </div>
</div>

<div class="annotated-step-red">
  <span class="red-callout">A</span>
  <p><strong>Statistikk-kort:</strong> Viser totalt antall nyhetsartikler, videoer og nyhetsbrev. Tallet oppdateres i sanntid når du legger til eller fjerner innhold.</p>
</div>
<div class="annotated-step-red">
  <span class="red-callout">B</span>
  <p><strong>Hurtiglenker:</strong> Klikk på en av lenkene for å gå direkte til den aktuelle funksjonen. Spar tid ved å gå rett til opprettelse av innlegg, videoer, spillere eller sideredigering.</p>
</div>
<div class="annotated-step-red">
  <span class="red-callout">C</span>
  <p><strong>Brukermanual:</strong> Klikk «Last ned brukermanual» for å laste ned denne komplette guiden som en HTML-fil du kan åpne i nettleseren eller skrive ut som PDF.</p>
</div>

<!-- ============ 4. NYHETER ============ -->
<h2 id="nyheter" class="page-break">4. 📰 Nyheter</h2>
<p class="section-intro">Her administrerer du alle nyhetsartikler som vises på forsiden og i nyhetsarkivet. Du kan opprette, redigere, fremheve og slette artikler, samt dele dem direkte til Facebook.</p>

<h3>Nyhetsoversikt</h3>
<div class="admin-screenshot">
  <div class="browser-bar">
    <span class="browser-dot red"></span>
    <span class="browser-dot yellow"></span>
    <span class="browser-dot green"></span>
    <span class="browser-url">fagerborgbk.no/admin/news</span>
  </div>
  <div style="background: #eef2f7; padding: 24px;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <div>
        <div class="admin-page-title">Nyheter</div>
        <div class="admin-page-subtitle">Administrer nyheter og innlegg (${data.newsCount} totalt)</div>
      </div>
      <div class="annotated-area" data-label="1">
        <div class="admin-btn admin-btn-primary">+ Ny nyhet</div>
      </div>
    </div>
    <div style="font-size: 12px; color: #6b7280; margin-bottom: 12px;">⭐ 6/3 fremhevede artikler i karusellen. Den eldste fjernes automatisk ved ny fremheving.</div>
    <div class="admin-card" style="padding: 0;">
      <!-- Article row 1 -->
      <div style="display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid #f3f4f6; gap: 12px;">
        <div style="width: 60px; height: 50px; background: #e5e7eb; border-radius: 6px; flex-shrink: 0;"></div>
        <div style="flex: 1;">
          <div style="font-weight: 600; font-size: 14px; color: #1a2744;">Tøff kveld i Valhall mot Furuset</div>
          <div style="font-size: 12px; color: #6b7280;">23. februar 2026 · 👁 0 visninger</div>
        </div>
        <span class="admin-badge admin-badge-green">Publisert</span>
        <span class="admin-badge admin-badge-blue">Fremhevet</span>
        <span class="admin-badge admin-badge-gray">Generelt</span>
        <div class="annotated-area" data-label="2" style="display: flex; gap: 4px;">
          <span style="padding: 4px 8px; cursor: pointer;">⭐</span>
          <span style="padding: 4px 8px; cursor: pointer;">✏️</span>
          <span style="padding: 4px 8px; cursor: pointer; color: #ef4444;">🗑️</span>
        </div>
      </div>
      <!-- Article row 2 -->
      <div style="display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid #f3f4f6; gap: 12px;">
        <div style="width: 60px; height: 50px; background: #e5e7eb; border-radius: 6px; flex-shrink: 0;"></div>
        <div style="flex: 1;">
          <div style="font-weight: 600; font-size: 14px; color: #1a2744;">Fagerborg snudde kampen mot BVH</div>
          <div style="font-size: 12px; color: #6b7280;">15. februar 2026 · 👁 10 visninger</div>
        </div>
        <span class="admin-badge admin-badge-green">Publisert</span>
        <span class="admin-badge admin-badge-blue">Fremhevet</span>
        <span class="admin-badge admin-badge-blue">📘 Facebook</span>
        <span style="padding: 4px 8px;">⭐</span>
        <span style="padding: 4px 8px;">✏️</span>
        <span style="padding: 4px 8px; color: #ef4444;">🗑️</span>
      </div>
      <!-- Article row 3 -->
      <div style="display: flex; align-items: center; padding: 12px 16px; gap: 12px;">
        <div style="width: 60px; height: 50px; background: #e5e7eb; border-radius: 6px; flex-shrink: 0;"></div>
        <div style="flex: 1;">
          <div style="font-weight: 600; font-size: 14px; color: #1a2744;">Treningskamper i vinter</div>
          <div style="font-size: 12px; color: #6b7280;">14. februar 2026 · 👁 14 visninger</div>
        </div>
        <span class="admin-badge admin-badge-green">Publisert</span>
        <span class="admin-badge admin-badge-blue">Fremhevet</span>
        <span style="padding: 4px 8px;">⭐</span>
        <span style="padding: 4px 8px;">✏️</span>
        <span style="padding: 4px 8px; color: #ef4444;">🗑️</span>
      </div>
    </div>
  </div>
</div>
<p class="diagram-caption">Nyhetsadministrasjonen med artikkelliste, statuser og handlingsknapper.</p>

<div class="annotated-step-red">
  <span class="red-callout">1</span>
  <p><strong>«+ Ny nyhet»-knappen</strong> (øverst til høyre): Klikk denne for å opprette en ny nyhetsartikkel. Du vil bli tatt til et redigeringsskjema.</p>
</div>
<div class="annotated-step-red">
  <span class="red-callout">2</span>
  <p><strong>Handlingsknapper</strong> (til høyre for hver artikkel): ⭐ = Fremhev/fjern fremheving (vises i karusellen på forsiden) · ✏️ = Rediger artikkelen · 🗑️ = Slett artikkelen</p>
</div>

<h3>Opprette ny artikkel</h3>
<div class="step-flow">
  <div class="step-box">📰 Nyheter</div>
  <span class="arrow">→</span>
  <div class="step-box highlight">+ Ny nyhet</div>
  <span class="arrow">→</span>
  <div class="step-box">Fyll inn felt</div>
  <span class="arrow">→</span>
  <div class="step-box">Status: Publisert</div>
  <span class="arrow">→</span>
  <div class="step-box highlight">💾 Lagre</div>
</div>

<div class="admin-screenshot">
  <div class="browser-bar">
    <span class="browser-dot red"></span>
    <span class="browser-dot yellow"></span>
    <span class="browser-dot green"></span>
    <span class="browser-url">fagerborgbk.no/admin/news/new</span>
  </div>
  <div style="background: #eef2f7; padding: 24px;">
    <div class="admin-card">
      <div style="margin-bottom: 16px;">
        <label style="font-size: 12px; font-weight: 600; color: #374151; display: block; margin-bottom: 4px;">Tittel</label>
        <div class="annotated-area" data-label="A">
          <div class="admin-input">Fagerborg slår tilbake med 3-1!</div>
        </div>
      </div>
      <div style="margin-bottom: 16px;">
        <label style="font-size: 12px; font-weight: 600; color: #374151; display: block; margin-bottom: 4px;">Bilde</label>
        <div class="annotated-area" data-label="B">
          <div style="border: 2px dashed #d1d5db; border-radius: 8px; padding: 24px; text-align: center; background: #f9fafb;">
            <div style="font-size: 24px; margin-bottom: 8px;">📷</div>
            <div style="font-size: 13px; color: #6b7280;">Dra og slipp bilde her, eller klikk for å laste opp</div>
          </div>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
        <div>
          <label style="font-size: 12px; font-weight: 600; color: #374151;">Kategori</label>
          <div class="admin-input">Kamprapport ▾</div>
        </div>
        <div>
          <label style="font-size: 12px; font-weight: 600; color: #374151;">Status</label>
          <div class="annotated-area" data-label="C">
            <div class="admin-input">Publisert ▾</div>
          </div>
        </div>
      </div>
      <div style="margin-bottom: 16px;">
        <label style="font-size: 12px; font-weight: 600; color: #374151; display: block; margin-bottom: 4px;">Innhold</label>
        <div style="border: 1px solid #d1d5db; border-radius: 6px; overflow: hidden;">
          <div style="background: #f9fafb; padding: 6px 10px; border-bottom: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
            <strong>B</strong> · <em>I</em> · <u>U</u> · 🔗 · H1 · H2 · • · 1.
          </div>
          <div style="padding: 12px; min-height: 80px; font-size: 13px; color: #9ca3af;">Skriv artikkelinnholdet her...</div>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
        <div class="admin-toggle on"><span class="toggle-knob"></span></div>
        <span style="font-size: 13px;">Fremhevet artikkel</span>
      </div>
      <div style="display: flex; gap: 8px;">
        <div class="annotated-area" data-label="D">
          <div class="admin-btn admin-btn-primary">💾 Lagre</div>
        </div>
        <div class="admin-btn admin-btn-outline">📘 Del på Facebook</div>
      </div>
    </div>
  </div>
</div>

<div class="annotated-step-red">
  <span class="red-callout">A</span>
  <p><strong>Tittel:</strong> Skriv en kort, beskrivende tittel. Denne vises på forsiden og i nyhetsarkivet.</p>
</div>
<div class="annotated-step-red">
  <span class="red-callout">B</span>
  <p><strong>Bilde:</strong> Dra og slipp et bilde, eller klikk for å velge fra datamaskinen. Anbefalt størrelse: 1200×630 piksler (liggende format).</p>
</div>
<div class="annotated-step-red">
  <span class="red-callout">C</span>
  <p><strong>Status:</strong> Velg «Publisert» for at artikkelen skal være synlig. «Kladd» holder den skjult inntil du er klar.</p>
</div>
<div class="annotated-step-red">
  <span class="red-callout">D</span>
  <p><strong>Lagre:</strong> Klikk «Lagre» for å publisere. Artikkelen vises umiddelbart på nettsiden.</p>
</div>

<div class="tip"><strong>📘 Facebook-deling:</strong> Etter lagring kan du dele artikkelen på klubbens Facebook-side med «Del på Facebook»-knappen. Artikkelen publiseres med bilde, tittel og lenke.</div>

<!-- ============ 5. VIDEOER ============ -->
<h2 id="videoer">5. 🎬 Videoer</h2>
<p class="section-intro">Her legger du til og administrerer videoer som vises i videogalleriet på nettsiden. Videoer kan kategoriseres og eventuelt passordbeskytes.</p>

<div class="step-flow">
  <div class="step-box">🎬 Videoer</div>
  <span class="arrow">→</span>
  <div class="step-box highlight">+ Ny video</div>
  <span class="arrow">→</span>
  <div class="step-box">Lim inn URL</div>
  <span class="arrow">→</span>
  <div class="step-box">Velg kategori</div>
  <span class="arrow">→</span>
  <div class="step-box highlight">💾 Lagre</div>
</div>

<div class="annotated-step-red">
  <span class="red-callout">1</span>
  <p>Klikk <strong>«+ Ny video»</strong>-knappen øverst til høyre på videosiden</p>
</div>
<div class="annotated-step-red">
  <span class="red-callout">2</span>
  <p>Lim inn <strong>YouTube- eller Hudl-URL</strong> i «Video-URL»-feltet. F.eks. <code>https://youtube.com/watch?v=...</code></p>
</div>
<div class="annotated-step-red">
  <span class="red-callout">3</span>
  <p>Fyll inn tittel, beskrivelse og velg <strong>kategori</strong> (f.eks. «Høydepunkter», «Treningskamper»)</p>
</div>
<div class="annotated-step-red">
  <span class="red-callout">4</span>
  <p>Valgfritt: Aktiver <strong>passordbeskyttelse</strong> – da må besøkende skrive inn et passord for å se videoen</p>
</div>
<div class="annotated-step-red">
  <span class="red-callout">5</span>
  <p>Sett status til <strong>«Publisert»</strong> og klikk <strong>«Lagre»</strong></p>
</div>

<!-- ============ 6. KAMPER ============ -->
<h2 id="kamper" class="page-break">6. 📅 Kamper og kampgrafikk</h2>
<p class="section-intro">Seriekamper synkroniseres automatisk fra Fotball.no (FIKS). Treningskamper og cuper legges inn manuelt. Herfra kan du også generere kampgrafikk for sosiale medier.</p>

<h3>Kampoversikt</h3>
<div class="admin-screenshot">
  <div class="browser-bar">
    <span class="browser-dot red"></span>
    <span class="browser-dot yellow"></span>
    <span class="browser-dot green"></span>
    <span class="browser-url">fagerborgbk.no/admin/matches</span>
  </div>
  <div style="background: #eef2f7; padding: 24px;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <div>
        <div class="admin-page-title">Kamper</div>
        <div class="admin-page-subtitle">Administrer treningskamper og andre kamper</div>
      </div>
      <div class="admin-btn admin-btn-primary">+ Legg til kamp</div>
    </div>
    <div style="display: flex; gap: 8px; margin-bottom: 16px;">
      <div class="annotated-area" data-label="1" style="display: flex; gap: 4px;">
        <span class="admin-btn admin-btn-primary" style="padding: 6px 14px; font-size: 12px;">Alle lag</span>
        <span class="admin-btn admin-btn-outline" style="padding: 6px 14px; font-size: 12px;">A-laget</span>
        <span class="admin-btn admin-btn-outline" style="padding: 6px 14px; font-size: 12px;">B-laget</span>
      </div>
    </div>
    <div class="admin-card" style="padding: 0;">
      <table class="admin-table">
        <tr><th>Dato</th><th>Lag</th><th>Motstander</th><th>Turnering</th><th>Sted</th><th>Status</th><th>Resultat</th><th></th></tr>
        <tr>
          <td>7. feb.<br><span style="font-size: 11px; color: #9ca3af;">16:00</span></td>
          <td><span class="admin-badge admin-badge-blue">A-laget</span></td>
          <td>@ Klemetsrud IL</td>
          <td>Treningskamp</td>
          <td>Lusetjern Kunstgress</td>
          <td><span class="admin-badge admin-badge-green">Ferdig</span></td>
          <td><strong>3-2</strong></td>
          <td style="display: flex; gap: 4px;">📸 ✏️ 🗑️</td>
        </tr>
        <tr>
          <td>15. feb.<br><span style="font-size: 11px; color: #9ca3af;">14:00</span></td>
          <td><span class="admin-badge admin-badge-blue">A-laget</span></td>
          <td>@ Bærums Verk Hauger</td>
          <td>Treningskamp</td>
          <td>Gommerud Kunstgress</td>
          <td><span class="admin-badge admin-badge-green">Ferdig</span></td>
          <td><strong>6-2</strong></td>
          <td>📸 ✏️ 🗑️</td>
        </tr>
        <tr>
          <td>8. apr.<br><span style="font-size: 11px; color: #9ca3af;">20:15</span></td>
          <td><span class="admin-badge admin-badge-blue">A-laget</span></td>
          <td>@ Bækkelaget</td>
          <td>5. div. menn avd. 01</td>
          <td>Ekeberg kunstgress 2</td>
          <td><div class="annotated-area" data-label="2"><span class="admin-badge admin-badge-yellow">Kommende</span></div></td>
          <td>-</td>
          <td>📸 ✏️ 🗑️</td>
        </tr>
      </table>
    </div>
  </div>
</div>
<p class="diagram-caption">Kampoversikten med filterfaner, kampliste og statusmerker. Data fra Fotball.no synkroniseres automatisk.</p>

<div class="annotated-step-red">
  <span class="red-callout">1</span>
  <p><strong>Lag-filter:</strong> Filtrer kamplisten etter «Alle lag», «A-laget» eller «B-laget» for å fokusere på kampene du trenger.</p>
</div>
<div class="annotated-step-red">
  <span class="red-callout">2</span>
  <p><strong>Status:</strong> Grønn «Ferdig» = kampen er spilt med resultat. Gul «Kommende» = fremtidig kamp uten resultat ennå.</p>
</div>

<h3>Kampgrafikk for sosiale medier</h3>
<p>Klikk på 📸-ikonet ved en kamp for å generere kampgrafikk som kan lastes ned og deles på Instagram, Facebook eller Stories.</p>

<div class="step-flow">
  <div class="step-box">📅 Kamper</div>
  <span class="arrow">→</span>
  <div class="step-box">Klikk 📸 ved kamp</div>
  <span class="arrow">→</span>
  <div class="step-box">Velg format</div>
  <span class="arrow">→</span>
  <div class="step-box highlight">📸 Last ned grafikk</div>
</div>

<!-- ============ 7. SPILLERSTALL ============ -->
<h2 id="spillerstall">7. 👥 Spillerstall</h2>
<p class="section-intro">Administrer alle spillerprofiler i A-laget og B-laget. Her kan du legge til nye spillere, redigere informasjon og kontrollere hvem som vises på nettsiden.</p>

<div class="step-flow">
  <div class="step-box">👥 Spillerstall</div>
  <span class="arrow">→</span>
  <div class="step-box highlight">+ Ny spiller</div>
  <span class="arrow">→</span>
  <div class="step-box">Fyll inn info</div>
  <span class="arrow">→</span>
  <div class="step-box highlight">💾 Lagre</div>
</div>

<div class="annotated-step-red">
  <span class="red-callout">1</span>
  <p>Fyll inn <strong>navn</strong>, <strong>posisjon</strong> (Keeper, Forsvar, Midtbane, Angrep), <strong>draktnummer</strong> og last opp spillerbilde</p>
</div>
<div class="annotated-step-red">
  <span class="red-callout">2</span>
  <p>Velg <strong>kategori</strong>: A-laget, B-laget eller Støtteapparat</p>
</div>
<div class="annotated-step-red">
  <span class="red-callout">3</span>
  <p>Sett status til <strong>Aktiv</strong> for å vise spilleren på nettsiden, <strong>Inaktiv</strong> for å skjule</p>
</div>

<!-- ============ 8. MEDLEMMER ============ -->
<h2 id="medlemmer" class="page-break">8. 🧑‍💼 Medlemmer og kontingent</h2>
<p class="section-intro">Oversikt over alle registrerte medlemmer. Herfra sender du kontingent-e-poster med Vipps/bank-informasjon og unike KID-numre.</p>

<h3>Medlemsliste</h3>
<div class="admin-screenshot">
  <div class="browser-bar">
    <span class="browser-dot red"></span>
    <span class="browser-dot yellow"></span>
    <span class="browser-dot green"></span>
    <span class="browser-url">fagerborgbk.no/admin/members</span>
  </div>
  <div style="background: #eef2f7; padding: 24px;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <div>
        <div class="admin-page-title">🧑‍💼 Medlemmer</div>
        <div class="admin-page-subtitle">45 medlemmer totalt</div>
      </div>
      <div class="annotated-area" data-label="1">
        <div class="admin-btn admin-btn-primary">📧 Send e-post</div>
      </div>
    </div>
    <div class="admin-card" style="padding: 0;">
      <table class="admin-table">
        <tr>
          <th style="width: 30px;">☐</th>
          <th>Navn</th>
          <th>E-post</th>
          <th>Telefon</th>
          <th>Status</th>
          <th>Registrert</th>
        </tr>
        <tr>
          <td>☐</td>
          <td>Ola Nordmann</td>
          <td>ola@epost.no</td>
          <td>912 34 567</td>
          <td><span class="admin-badge admin-badge-green">Aktiv</span></td>
          <td>14. jan. 2026</td>
        </tr>
        <tr>
          <td><div class="annotated-area" data-label="2">☑️</div></td>
          <td>Kari Nordmann</td>
          <td>kari@epost.no</td>
          <td>923 45 678</td>
          <td><span class="admin-badge admin-badge-yellow">Ventende</span></td>
          <td>20. jan. 2026</td>
        </tr>
        <tr>
          <td>☐</td>
          <td>Per Hansen</td>
          <td>per@epost.no</td>
          <td>934 56 789</td>
          <td><span class="admin-badge admin-badge-green">Aktiv</span></td>
          <td>2. feb. 2026</td>
        </tr>
      </table>
    </div>
  </div>
</div>

<div class="annotated-step-red">
  <span class="red-callout">1</span>
  <p><strong>«Send e-post»-knappen:</strong> Sender kontingent-e-post til de avkryssede medlemmene. E-posten inneholder betalingsinformasjon, Vipps-lenke og unikt KID-nummer.</p>
</div>
<div class="annotated-step-red">
  <span class="red-callout">2</span>
  <p><strong>Avkryssingsboks:</strong> Merk av de medlemmene du vil sende e-post til. Du kan velge én, flere eller alle.</p>
</div>

<h3>Sende kontingent-e-post</h3>
<div class="step-flow">
  <div class="step-box">☑️ Velg medlemmer</div>
  <span class="arrow">→</span>
  <div class="step-box highlight">📧 Send e-post</div>
  <span class="arrow">→</span>
  <div class="step-box">👁️ Forhåndsvisning</div>
  <span class="arrow">→</span>
  <div class="step-box highlight">✅ Bekreft sending</div>
</div>

<div class="admin-screenshot">
  <div class="browser-bar">
    <span class="browser-dot red"></span>
    <span class="browser-dot yellow"></span>
    <span class="browser-dot green"></span>
    <span class="browser-url">E-post-dialog</span>
  </div>
  <div style="background: #eef2f7; padding: 24px; display: flex; justify-content: center;">
    <div class="admin-card" style="max-width: 480px; width: 100%;">
      <div style="display: flex; gap: 16px; margin-bottom: 16px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">
        <strong style="border-bottom: 2px solid #1a2744; padding-bottom: 4px; font-size: 13px;">⚙️ Innstillinger</strong>
        <span style="font-size: 13px; color: #6b7280;">👁️ Forhåndsvisning</span>
      </div>
      <div style="margin-bottom: 12px;">
        <label style="font-size: 12px; font-weight: 600;">Emne</label>
        <div class="admin-input">Medlemskap i Fagerborg BK</div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 12px;">
        <div>
          <label style="font-size: 12px; font-weight: 600;">Kontonr.</label>
          <div class="annotated-area" data-label="A">
            <div class="admin-input">1503.72.32329</div>
          </div>
        </div>
        <div>
          <label style="font-size: 12px; font-weight: 600;">Beløp</label>
          <div class="admin-input">500</div>
        </div>
        <div>
          <label style="font-size: 12px; font-weight: 600;">KID-prefiks</label>
          <div class="annotated-area" data-label="B">
            <div class="admin-input">2026</div>
          </div>
        </div>
      </div>
      <div class="admin-btn admin-btn-primary" style="width: 100%; justify-content: center;">📧 Send til 2 medlemmer</div>
    </div>
  </div>
</div>

<div class="annotated-step-red">
  <span class="red-callout">A</span>
  <p><strong>Kontonummer:</strong> Klubbens bankkonto som vises i e-posten til medlemmene.</p>
</div>
<div class="annotated-step-red">
  <span class="red-callout">B</span>
  <p><strong>KID-prefiks:</strong> Hvert medlem får automatisk et unikt KID-nummer basert på prefikset + medlems-ID. F.eks. «2026-001» for første medlem.</p>
</div>

<div class="warning"><strong>⚠️ Forhåndsvisning:</strong> Klikk alltid på «Forhåndsvisning»-fanen i dialogvinduet for å se nøyaktig hvordan e-posten vil se ut for mottakeren, inkludert logo, betalingsinfo og personlig hilsen.</div>

<!-- ============ 9. STYRET ============ -->
<h2 id="styret">9. 🏅 Styret</h2>
<p class="section-intro">Rediger styremedlemmer som vises på nettsiden. Endre navn, roller og rekkefølge direkte i listen.</p>

<!-- ============ 10. TABELLHISTORIKK ============ -->
<h2 id="tabellhistorikk">10. 📈 Tabellhistorikk</h2>
<p class="section-intro">Legg til historiske tabellplasseringer for å vise klubbens utvikling over tid.</p>
<div class="step-flow">
  <div class="step-box">📈 Tabellhistorikk</div>
  <span class="arrow">→</span>
  <div class="step-box highlight">+ Ny sesong</div>
  <span class="arrow">→</span>
  <div class="step-box">Velg år/divisjon</div>
  <span class="arrow">→</span>
  <div class="step-box highlight">💾 Lagre</div>
</div>

<!-- ============ 11. SIDER ============ -->
<h2 id="sider">11. 📄 Sider</h2>
<p class="section-intro">Rediger innholdet på de statiske sidene som «Om klubben», «Kontakt», «Personvern» osv. Endringer vises umiddelbart på nettsiden etter lagring.</p>

<div class="annotated-step-red">
  <span class="red-callout">1</span>
  <p>Velg siden du vil redigere fra listen (f.eks. «Om klubben»)</p>
</div>
<div class="annotated-step-red">
  <span class="red-callout">2</span>
  <p>Bruk <strong>teksteditoren</strong> til å redigere innholdet. Editoren støtter overskrifter, lenker, lister, bilder og formatering.</p>
</div>
<div class="annotated-step-red">
  <span class="red-callout">3</span>
  <p>Klikk <strong>«Lagre»</strong> – endringene vises umiddelbart på den offentlige nettsiden.</p>
</div>

<!-- ============ 12. SPONSORER ============ -->
<h2 id="sponsorer">12. ⭐ Sponsorer</h2>
<p class="section-intro">Administrer sponsorer som vises i sponsorkarusellen på forsiden. Du kan ha én hovedsponsor og ubegrenset med partnere.</p>

<div class="warning"><strong>⚠️ Viktig:</strong> Sponsorseksjonen må først aktiveres i <strong>Innstillinger → Funksjoner → Sponsorer</strong> for å vises på nettsiden. Se kapittel 14.</div>

<div class="admin-screenshot">
  <div class="browser-bar">
    <span class="browser-dot red"></span>
    <span class="browser-dot yellow"></span>
    <span class="browser-dot green"></span>
    <span class="browser-url">fagerborgbk.no/admin/sponsors</span>
  </div>
  <div style="background: #eef2f7; padding: 24px;">
    <div class="admin-page-title">Sponsorer</div>
    <div class="admin-page-subtitle">Administrer hovedsponsor og partnere</div>
    
    <!-- Hovedsponsor section -->
    <div class="admin-card" style="margin-top: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <div>
          <strong style="font-size: 16px;">⭐ Hovedsponsor</strong>
          <div style="font-size: 12px; color: #6b7280;">Hovedsponsoren vises prominent på forsiden</div>
        </div>
        <div class="admin-btn admin-btn-primary" style="font-size: 12px;">+ Legg til</div>
      </div>
      <table class="admin-table">
        <tr><th>Logo</th><th>Navn</th><th>Nettside</th><th>Status</th><th>Rekkefølge</th><th></th></tr>
        <tr>
          <td style="color: #9ca3af;">Ingen logo</td>
          <td>Storm Elektro AS</td>
          <td><a style="color: #2563eb;">🔗 Besøk</a></td>
          <td>
            <div style="display: flex; align-items: center; gap: 6px;">
              <div class="annotated-area" data-label="1">
                <div class="admin-toggle off"><span class="toggle-knob"></span></div>
              </div>
              <span style="font-size: 12px; color: #9ca3af;">Inaktiv</span>
            </div>
          </td>
          <td>0</td>
          <td>✏️ 🗑️</td>
        </tr>
      </table>
    </div>

    <!-- Partnere section -->
    <div class="admin-card" style="margin-top: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <div>
          <strong style="font-size: 16px;">⭐ Partnere</strong>
          <div style="font-size: 12px; color: #6b7280;">Partnere vises i sponsorkarusellen</div>
        </div>
        <div class="annotated-area" data-label="2">
          <div class="admin-btn admin-btn-primary" style="font-size: 12px;">+ Legg til</div>
        </div>
      </div>
      <table class="admin-table">
        <tr><th>Logo</th><th>Navn</th><th>Nettside</th><th>Status</th><th>Rekkefølge</th><th></th></tr>
        <tr>
          <td style="font-weight: 700;">BonSu</td>
          <td>BonSu</td>
          <td><a style="color: #2563eb;">🔗 Besøk</a></td>
          <td>
            <div style="display: flex; align-items: center; gap: 6px;">
              <div class="admin-toggle on"><span class="toggle-knob"></span></div>
              <span style="font-size: 12px; color: #166534;">Aktiv</span>
            </div>
          </td>
          <td>0</td>
          <td>✏️ 🗑️</td>
        </tr>
        <tr>
          <td style="font-weight: 700; font-style: italic;">DIADORA</td>
          <td>Diadora</td>
          <td><a style="color: #2563eb;">🔗 Besøk</a></td>
          <td>
            <div style="display: flex; align-items: center; gap: 6px;">
              <div class="admin-toggle on"><span class="toggle-knob"></span></div>
              <span style="font-size: 12px; color: #166534;">Aktiv</span>
            </div>
          </td>
          <td>0</td>
          <td>✏️ 🗑️</td>
        </tr>
        <tr>
          <td style="color: #9ca3af;">Ingen logo</td>
          <td>Den Glade Gris</td>
          <td><a style="color: #2563eb;">🔗 Besøk</a></td>
          <td>
            <div style="display: flex; align-items: center; gap: 6px;">
              <div class="admin-toggle off"><span class="toggle-knob"></span></div>
              <span style="font-size: 12px; color: #9ca3af;">Inaktiv</span>
            </div>
          </td>
          <td>1</td>
          <td>✏️ 🗑️</td>
        </tr>
      </table>
    </div>
  </div>
</div>
<p class="diagram-caption">Sponsoradministrasjonen med hovedsponsor og partnerliste. Toggle-bryteren kontrollerer synligheten på forsiden.</p>

<div class="annotated-step-red">
  <span class="red-callout">1</span>
  <p><strong>Status-toggle:</strong> Skru av/på for å vise eller skjule sponsoren på forsiden. Blå = aktiv (synlig), grå = inaktiv (skjult).</p>
</div>
<div class="annotated-step-red">
  <span class="red-callout">2</span>
  <p><strong>«+ Legg til»:</strong> Klikk for å legge til en ny partner. Fyll inn navn, nettside-URL og last opp logo.</p>
</div>

<div class="step-flow">
  <div class="step-box">⚙️ Aktiver i Innstillinger</div>
  <span class="arrow">→</span>
  <div class="step-box">⭐ Sponsorer</div>
  <span class="arrow">→</span>
  <div class="step-box highlight">+ Legg til</div>
  <span class="arrow">→</span>
  <div class="step-box">Fyll inn info + logo</div>
  <span class="arrow">→</span>
  <div class="step-box highlight">💾 Lagre</div>
</div>

<!-- ============ 13. PERSONVERN ============ -->
<h2 id="personvern">13. 🛡️ Personvern (GDPR)</h2>
<p class="section-intro">Administrer personvernrelaterte forespørsler og oversikt over databehandling i henhold til GDPR.</p>

<!-- ============ 14. NYHETSBREV ============ -->
<h2 id="nyhetsbrev" class="page-break">14. 📧 Nyhetsbrev</h2>
<p class="section-intro">Generer og send nyhetsbrev til alle aktive medlemmer. AI-funksjonen lager automatisk et utkast basert på siste nyheter og kommende kamper.</p>

<div class="step-flow">
  <div class="step-box">📧 Nyhetsbrev</div>
  <span class="arrow">→</span>
  <div class="step-box highlight">✨ Generer</div>
  <span class="arrow">→</span>
  <div class="step-box">Rediger innhold</div>
  <span class="arrow">→</span>
  <div class="step-box">📨 Test-send</div>
  <span class="arrow">→</span>
  <div class="step-box highlight">📤 Send til alle</div>
</div>

<div class="annotated-step-red">
  <span class="red-callout">1</span>
  <p>Klikk <strong>«Generer nyhetsbrev»</strong> – AI lager et utkast basert på siste nyheter, kommende kamper og annen relevant informasjon</p>
</div>
<div class="annotated-step-red">
  <span class="red-callout">2</span>
  <p>Rediger innholdet etter behov i HTML-editoren. Du kan endre tekst, legge til bilder og tilpasse formateringen.</p>
</div>
<div class="annotated-step-red">
  <span class="red-callout">3</span>
  <p>Send <strong>test-e-post</strong> til din egen adresse for å sjekke utseendet. Sjekk at alle lenker fungerer og at formateringen ser bra ut.</p>
</div>
<div class="annotated-step-red">
  <span class="red-callout">4</span>
  <p>Når du er fornøyd, klikk <strong>«Send til alle»</strong> for å distribuere til alle aktive medlemmer som ikke har meldt seg av.</p>
</div>

<div class="warning"><strong>⚠️ Kan ikke angres:</strong> Nyhetsbrev kan kun sendes én gang. Kontroller innholdet nøye med test-e-post før du sender til alle.</div>
<div class="tip"><strong>💡 Avmelding:</strong> Medlemmer kan melde seg av nyhetsbrev via avmeldingslenken i bunnen av e-posten.</div>

<!-- ============ 15. INNSTILLINGER ============ -->
<h2 id="innstillinger">15. ⚙️ Innstillinger</h2>
<p class="section-intro">Her styrer du hvilke funksjoner som er aktive på nettsiden, samt integrasjoner mot Facebook og TikTok.</p>

<h3>Funksjons-toggles</h3>
<div class="admin-screenshot">
  <div class="browser-bar">
    <span class="browser-dot red"></span>
    <span class="browser-dot yellow"></span>
    <span class="browser-dot green"></span>
    <span class="browser-url">fagerborgbk.no/admin/settings</span>
  </div>
  <div style="background: #eef2f7; padding: 24px;">
    <div class="admin-page-title">Innstillinger</div>
    <div class="admin-page-subtitle">Administrer nettsidens innstillinger</div>
    <div class="admin-card">
      <div style="margin-bottom: 8px;">
        <strong style="font-size: 16px;">⚙️ Funksjoner</strong>
        <div style="font-size: 12px; color: #6b7280;">Aktiver eller deaktiver funksjoner på nettsiden</div>
      </div>
      <div style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong style="font-size: 14px;">Sponsorer</strong>
          <div style="font-size: 12px; color: #6b7280;">Vis sponsorseksjon og sponsoradministrasjon</div>
        </div>
        <div class="annotated-area" data-label="1">
          <div class="admin-toggle ${data.features['sponsors_enabled'] ? 'on' : 'off'}"><span class="toggle-knob"></span></div>
        </div>
      </div>
      <div style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong style="font-size: 14px;">Klubbportaler</strong>
          <div style="font-size: 12px; color: #6b7280;">Vis lenker til Spiller- og Trenerportalen i bunnteksten</div>
        </div>
        <div class="admin-toggle ${data.features['portals_enabled'] ? 'on' : 'off'}"><span class="toggle-knob"></span></div>
      </div>
      <div style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong style="font-size: 14px;">Podcast</strong>
          <div style="font-size: 12px; color: #6b7280;">Vis Podcast i navigasjonen og videomenyen</div>
        </div>
        <div class="admin-toggle ${data.features['podcast_enabled'] ? 'on' : 'off'}"><span class="toggle-knob"></span></div>
      </div>
      <div style="padding: 12px 0; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong style="font-size: 14px;">Direktesendinger</strong>
          <div style="font-size: 12px; color: #6b7280;">Vis «Se live»-knapp på kampkort og aktiver direktesendingssiden</div>
        </div>
        <div class="admin-toggle ${data.features['livestream_enabled'] ? 'on' : 'off'}"><span class="toggle-knob"></span></div>
      </div>
    </div>
  </div>
</div>
<p class="diagram-caption">Innstillingssiden med funksjons-toggles. Blå = aktivert, grå = deaktivert.</p>

<div class="annotated-step-red">
  <span class="red-callout">1</span>
  <p><strong>Sponsor-toggle:</strong> Denne må være skrudd på (blå) for at sponsorseksjonen skal vises på forsiden. Når den er av, skjules både sponsorkarusellen og sponsormenypunktet.</p>
</div>

<h3>Facebook-integrasjon</h3>
<p>Innstillingssiden viser også status for Facebook-integrasjonen. Et grønt merke betyr at tokenet er gyldig.</p>

<div class="annotated-step-red">
  <span class="red-callout">!</span>
  <p>Dersom Facebook-tokenet utløper (vises som rødt), klikk <strong>«Forny via Facebook»</strong>. Du blir bedt om å logge inn på Facebook og godkjenne tillatelser. Etter fornyelse genereres et <strong>permanent</strong> Page Access Token som aldri utløper.</p>
</div>

<div class="step-flow">
  <div class="step-box highlight">🔑 Forny via Facebook</div>
  <span class="arrow">→</span>
  <div class="step-box">Logg inn</div>
  <span class="arrow">→</span>
  <div class="step-box">Godkjenn</div>
  <span class="arrow">→</span>
  <div class="step-box highlight">✅ Permanent token lagret</div>
</div>

<!-- ============ 16. ADMINS ============ -->
<h2 id="admins">16. 👤 Administratorer</h2>
<p class="section-intro"><em>(Kun synlig for Superadmin)</em> Her inviterer og administrerer du andre admin-brukere.</p>

<div class="step-flow">
  <div class="step-box">👤 Admins</div>
  <span class="arrow">→</span>
  <div class="step-box highlight">+ Inviter admin</div>
  <span class="arrow">→</span>
  <div class="step-box">Skriv inn e-post</div>
  <span class="arrow">→</span>
  <div class="step-box">Velg rolle</div>
  <span class="arrow">→</span>
  <div class="step-box highlight">📧 Send invitasjon</div>
</div>

<table>
  <tr><th>Rolle</th><th>Tilgang</th></tr>
  <tr><td><strong>Superadmin</strong></td><td>Full tilgang til alt, inkludert brukeradministrasjon og innstillinger</td></tr>
  <tr><td><strong>Site Admin</strong></td><td>Tilgang til innholdsadministrasjon (nyheter, kamper, videoer, spillere)</td></tr>
</table>

<!-- ============ 17. OFFENTLIG ============ -->
<h2 id="offentlig" class="page-break">17. 🌐 Offentlig nettside</h2>
<p class="section-intro">Den offentlige nettsiden er tilgjengelig for alle besøkende uten innlogging.</p>

<div class="admin-screenshot">
  <div class="browser-bar">
    <span class="browser-dot red"></span>
    <span class="browser-dot yellow"></span>
    <span class="browser-dot green"></span>
    <span class="browser-url">fagerborgbk.no</span>
  </div>
  <div style="background: #1a2744; color: white; border-radius: 0 0 8px 8px; padding: 12px 20px; display: flex; align-items: center; justify-content: space-between;">
    <div style="display: flex; align-items: center; gap: 20px;">
      <strong>⚽ Fagerborg BK</strong>
      <span style="font-size: 13px;">Hjem</span>
      <span style="font-size: 13px;">Kamper ▾</span>
      <span style="font-size: 13px;">Se ▾</span>
      <span style="font-size: 13px;">Om ▾</span>
      <span style="font-size: 13px;">Kontakt</span>
    </div>
    <div class="admin-btn admin-btn-yellow" style="font-size: 12px;">Bli medlem</div>
  </div>
</div>

<table>
  <tr><th>Meny</th><th>Innhold</th></tr>
  <tr><td><strong>Hjem</strong></td><td>Forsidebanner med siste nyheter, kampwidget, ligatabell, sponsorkarusell, Grasrot-info</td></tr>
  <tr><td><strong>Kamper</strong></td><td>Kampkalender, neste-kamp-widget, filtrering per lag (A-laget/B-laget)</td></tr>
  <tr><td><strong>Se</strong></td><td>Videoer sortert i kategorier, mulighet for passordbeskyttelse</td></tr>
  <tr><td><strong>Om klubben</strong></td><td>Klubbinfo, historie, spillerstall med bilder og nøkkelinfo</td></tr>
  <tr><td><strong>Kontakt</strong></td><td>Kontaktskjema som sender e-post til post@fagerborgbk.no</td></tr>
</table>

<h3>Bli medlem</h3>
<div class="step-flow">
  <div class="step-box">Klikk «Bli medlem»</div>
  <span class="arrow">→</span>
  <div class="step-box">Fyll inn skjema</div>
  <span class="arrow">→</span>
  <div class="step-box">Motta e-post</div>
  <span class="arrow">→</span>
  <div class="step-box highlight">Betal kontingent</div>
</div>

<h3>Grasrotandelen</h3>
<p>Forsiden viser informasjon om Norsk Tippings Grasrotandel. Beløpet oppdateres automatisk.</p>

<div style="margin-top: 48px; padding-top: 16px; border-top: 2px solid #ddd; text-align: center; color: #999; font-size: 12px;">
  <p><strong>Fagerborg BK</strong> – Stiftet 1914</p>
  <p>Fagerborggata 50 A, 0360 Oslo</p>
  <p>Denne manualen ble generert ${new Date().toLocaleDateString('nb-NO', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
</div>

</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Fagerborg-BK-Brukermanual.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
