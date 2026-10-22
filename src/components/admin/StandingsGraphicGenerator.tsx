import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, Image, Loader2, Share2, Instagram } from 'lucide-react';
import { useStandings, Standing } from '@/hooks/useStandings';
import { toast } from 'sonner';
import standingsBgFallback from '@/assets/standings-bg.jpg';
import fagerborgLogo from '@/assets/fagerborg-logo.png';
import { useDefaultBackground } from '@/hooks/useGraphicBackgrounds';

interface StandingsGraphicGeneratorProps {
  team: 'A-laget' | 'B-laget';
}

export function StandingsGraphicGenerator({ team }: StandingsGraphicGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [storyMode, setStoryMode] = useState(false);
  const graphicRef = useRef<HTMLDivElement>(null);
  const { data: standings } = useStandings(team);
  const { data: defaultBg } = useDefaultBackground();
  const standingsBg = defaultBg?.image_url || standingsBgFallback;

  const fagerborgStanding = standings?.find(
    (s) => s.team_name.toLowerCase().includes('fagerborg')
  );
  const fagerborgPosition = fagerborgStanding?.position ?? 0;

  const getVisibleStandings = (): Standing[] => {
    if (!standings || standings.length === 0) return [];
    if (fagerborgPosition <= 5) return standings.slice(0, 5);
    const idx = standings.findIndex((s) => s.team_name.toLowerCase().includes('fagerborg'));
    if (idx === -1) return standings.slice(0, 5);
    const start = Math.max(0, idx - 2);
    return standings.slice(start, start + 5);
  };

  const visibleStandings = getVisibleStandings();
  const season = fagerborgStanding?.season || new Date().getFullYear().toString();
  const league = fagerborgStanding?.league || '';
  const played = fagerborgStanding?.played ?? 0;

  const fileName = `tabell-${team.toLowerCase()}-${new Date().toISOString().split('T')[0]}.png`;

  const generateImage = async (): Promise<Blob | null> => {
    const scale = 4;
    const cvs = document.createElement('canvas');
    cvs.width = w * scale;
    cvs.height = h * scale;
    const ctx = cvs.getContext('2d')!;
    ctx.scale(scale, scale);

    const bottomPad = storyMode ? 40 : 24;
    const sidePad = 24;
    const innerW = w - 2 * sidePad;
    const gapSize = 5;
    const nRows = visibleStandings.length;
    const totalRowsH = nRows * rowH + (nRows - 1) * gapSize;

    // Layout positions (from bottom)
    const footerTextY = h - bottomPad - 8;
    const rowsBottomY = footerTextY - 22;
    const firstRowY = rowsBottomY - totalRowsH;
    const headerTextY = firstRowY - 14;

    // 1. Fill background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, w, h);

    // 2. Draw background image
    try {
      const bgImg = new window.Image();
      bgImg.crossOrigin = 'anonymous';
      bgImg.src = standingsBg;
      await new Promise<void>((resolve) => {
        if (bgImg.complete && bgImg.naturalWidth > 0) { resolve(); return; }
        bgImg.onload = () => resolve();
        bgImg.onerror = () => resolve();
      });
      if (bgImg.naturalWidth > 0) {
        const bgH = h - tableAreaH + 60;
        const scX = w / bgImg.naturalWidth;
        const scY = bgH / bgImg.naturalHeight;
        const coverScale = Math.max(scX, scY);
        const sw = bgImg.naturalWidth * coverScale;
        const sh = bgImg.naturalHeight * coverScale;
        const dx = (w - sw) / 2;
        const dy = (bgH - sh) * 0.2;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, w, bgH);
        ctx.clip();
        ctx.drawImage(bgImg, dx, dy, sw, sh);
        ctx.restore();
      }
    } catch { /* ignore */ }

    // 3. Gradient overlay
    const fadeStart = Math.max(0, (h - tableAreaH - 20) / h);
    const fadeMid = Math.max(0, (h - tableAreaH + 40) / h);
    const fadeEnd = Math.max(0, (h - tableAreaH + 80) / h);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(10,10,10,0)');
    grad.addColorStop(fadeStart, 'rgba(10,10,10,0)');
    grad.addColorStop(fadeMid, 'rgba(10,10,10,0.85)');
    grad.addColorStop(fadeEnd, 'rgba(10,10,10,1)');
    grad.addColorStop(1, 'rgba(10,10,10,1)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 4. Pre-load logos as data URLs
    const logoImages = new Map<string, HTMLImageElement>();
    await Promise.all(visibleStandings.map(async (s) => {
      if (!s.logo_url) return;
      try {
        const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-proxy?url=${encodeURIComponent(s.logo_url)}`;
        const resp = await fetch(proxyUrl);
        const blob = await resp.blob();
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        const img = new window.Image();
        img.src = dataUrl;
        await new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) { resolve(); return; }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
        if (img.naturalWidth > 0) logoImages.set(s.id, img);
      } catch { /* ignore */ }
    }));

    // 5. Header text
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#9ca3af';
    ctx.font = `12px ${font}`;
    ctx.textAlign = 'left';
    ctx.fillText(`${league} · ${season}`, sidePad + 4, headerTextY);
    ctx.textAlign = 'center';
    ctx.font = `11px ${font}`;
    ctx.fillText('P', w - sidePad - 12 - 44 - 22, headerTextY);
    ctx.fillText('MF', w - sidePad - 12 - 22, headerTextY);

    // Helper: rounded rect
    const roundRect = (x: number, y: number, rw: number, rh: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + rw - r, y);
      ctx.quadraticCurveTo(x + rw, y, x + rw, y + r);
      ctx.lineTo(x + rw, y + rh - r);
      ctx.quadraticCurveTo(x + rw, y + rh, x + rw - r, y + rh);
      ctx.lineTo(x + r, y + rh);
      ctx.quadraticCurveTo(x, y + rh, x, y + rh - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    };

    // 6. Draw rows
    visibleStandings.forEach((s, i) => {
      const isFB = s.team_name.toLowerCase().includes('fagerborg');
      const ry = firstRowY + i * (rowH + gapSize);
      const cy = ry + rowH / 2;

      // Row background
      roundRect(sidePad, ry, innerW, rowH, 6);
      ctx.fillStyle = isFB ? 'rgba(220,38,38,0.12)' : 'rgba(255,255,255,0.06)';
      ctx.fill();
      ctx.strokeStyle = isFB ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)';
      ctx.lineWidth = isFB ? 1.5 : 1;
      ctx.stroke();

      // Position number
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillStyle = isFB ? '#f87171' : '#d1d5db';
      ctx.font = `bold 16px ${font}`;
      ctx.fillText(String(s.position), sidePad + 12 + 14, cy);

      // Logo
      const logoImg = logoImages.get(s.id);
      if (logoImg) {
        const logoSize = 26;
        const logoX = sidePad + 12 + 28 + 10;
        const logoY = cy - logoSize / 2;
        const lr = Math.min(logoSize / logoImg.naturalWidth, logoSize / logoImg.naturalHeight);
        const lw = logoImg.naturalWidth * lr;
        const lh = logoImg.naturalHeight * lr;
        ctx.drawImage(logoImg, logoX + (logoSize - lw) / 2, logoY + (logoSize - lh) / 2, lw, lh);
      }

      // Team name
      ctx.textAlign = 'left';
      ctx.fillStyle = isFB ? '#ffffff' : '#e5e7eb';
      ctx.font = `${isFB ? 'bold' : '500'} 14px ${font}`;
      ctx.fillText(s.team_name.toUpperCase(), sidePad + 12 + 28 + 10 + 26 + 12, cy);

      // Points
      ctx.textAlign = 'center';
      ctx.fillStyle = isFB ? '#ffffff' : '#e5e7eb';
      ctx.font = `bold 16px ${font}`;
      ctx.fillText(String(s.points), w - sidePad - 12 - 44 - 22, cy);

      // Goal difference
      ctx.fillStyle = isFB ? '#f87171' : '#9ca3af';
      ctx.font = `600 14px ${font}`;
      const gdText = s.goal_difference > 0 ? `+${s.goal_difference}` : String(s.goal_difference);
      ctx.fillText(gdText, w - sidePad - 12 - 22, cy);
    });

    // 7. Footer
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#6b7280';
    ctx.font = `10px ${font}`;
    ctx.fillText('FAGERBORG BALLKLUB', w / 2, footerTextY);

    // 8. Fagerborg logo (transparent, below footer text)
    try {
      const logoImg = new window.Image();
      logoImg.crossOrigin = 'anonymous';
      logoImg.src = fagerborgLogo;
      await new Promise<void>((resolve) => {
        if (logoImg.complete && logoImg.naturalWidth > 0) { resolve(); return; }
        logoImg.onload = () => resolve();
        logoImg.onerror = () => resolve();
      });
      if (logoImg.naturalWidth > 0) {
        const logoSize = 32;
        const logoX = w / 2 - logoSize / 2;
        const logoY = footerTextY + 10;
        ctx.globalAlpha = 0.3;
        ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
        ctx.globalAlpha = 1.0;
      }
    } catch { /* ignore */ }

    return new Promise((resolve) => { cvs.toBlob((blob) => resolve(blob), 'image/png', 1.0); });
  };

  const canShare = typeof navigator !== 'undefined' && navigator.share && navigator.canShare;

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      const blob = await generateImage();
      if (!blob) throw new Error('Kunne ikke generere bilde');
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile && canShare) {
        const file = new File([blob], fileName, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: `Tabell: ${team}` });
          toast.success('Delt!'); return;
        }
      }
      const url = URL.createObjectURL(blob);
      setGeneratedImageUrl(url);
      const link = document.createElement('a');
      link.href = url; link.download = fileName;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      toast.success('Bilde lastet ned');
    } catch (error) {
      if ((error as Error).name !== 'AbortError') { toast.error('Kunne ikke laste ned bildet'); }
    } finally { setIsGenerating(false); }
  };

  const handleInstagramStory = async () => {
    setIsGenerating(true); setStoryMode(true);
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    try {
      const blob = await generateImage();
      if (!blob) throw new Error('Kunne ikke generere bilde');
      const file = new File([blob], fileName.replace('.png', '-story.png'), { type: 'image/png' });
      if (canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Tabell: ${team}` }); toast.success('Delt!');
      } else {
        setGeneratedImageUrl(URL.createObjectURL(blob));
        toast.info('Last ned bildet og del det på Instagram Stories');
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') { toast.error('Kunne ikke dele bildet'); }
    } finally { setIsGenerating(false); setStoryMode(false); }
  };

  const handleShare = async () => {
    setIsGenerating(true);
    try {
      const blob = await generateImage();
      if (!blob) throw new Error('Kunne ikke generere bilde');
      const file = new File([blob], fileName, { type: 'image/png' });
      if (canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Tabell: ${team}` }); toast.success('Delt!');
      } else {
        setGeneratedImageUrl(URL.createObjectURL(blob));
        toast.info('Hold inne bildet for å lagre det');
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') { toast.error('Kunne ikke dele bildet'); }
    } finally { setIsGenerating(false); }
  };

  const handleClose = (open: boolean) => {
    setIsOpen(open);
    if (!open && generatedImageUrl) { URL.revokeObjectURL(generatedImageUrl); setGeneratedImageUrl(null); }
  };

  if (!standings || standings.length === 0) return null;

  const w = storyMode ? 540 : 600;
  const h = storyMode ? 960 : 600;
  const rowH = storyMode ? 48 : 44;
  const tableAreaH = visibleStandings.length * (rowH + 6) + 70; // rows + header + footer
  const font = 'Arial, Helvetica, sans-serif';

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        <Image className="h-4 w-4 mr-2" />
        Tabellgrafikk {team}
      </Button>

      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tabellgrafikk – {team}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4">
            {generatedImageUrl ? (
              <div className="flex flex-col items-center gap-4 w-full">
                <p className="text-sm text-muted-foreground text-center">
                  Hold inne bildet nedenfor for å lagre det til kamerarullen
                </p>
                <img src={generatedImageUrl} alt="Tabellgrafikk" className="max-w-full rounded-lg shadow-lg" style={{ maxHeight: '60vh' }} />
                <Button variant="outline" onClick={() => setGeneratedImageUrl(null)} className="w-full max-w-xs">
                  Generer på nytt
                </Button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto w-full flex justify-center">
                  <div
                    ref={graphicRef}
                    className="relative overflow-hidden flex-shrink-0"
                    style={{ width: `${w}px`, height: `${h}px`, background: '#0a0a0a' }}
                  >
                    {/* Background image — fills the top portion */}
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0,
                      height: `${h - tableAreaH + 60}px`,
                      backgroundImage: `url(${standingsBg})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center 20%',
                    }} />

                    {/* Gradient fade from image to dark */}
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                      background: `linear-gradient(to bottom, 
                        transparent 0%, 
                        transparent ${Math.round((h - tableAreaH - 20) / h * 100)}%, 
                        rgba(10,10,10,0.85) ${Math.round((h - tableAreaH + 40) / h * 100)}%, 
                        rgba(10,10,10,1) ${Math.round((h - tableAreaH + 80) / h * 100)}%, 
                        #0a0a0a 100%)`,
                    }} />

                    {/* Table content pinned to bottom */}
                    <div style={{
                      position: 'absolute', bottom: storyMode ? '40px' : '24px',
                      left: '24px', right: '24px',
                    }}>
                      {/* Header row with league name and column labels */}
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
                        marginBottom: '12px', padding: '0 4px',
                      }}>
                        <span style={{ color: '#9ca3af', fontFamily: font, fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase' }}>
                          {league} · {season}
                        </span>
                        <div style={{ display: 'flex', gap: '0px' }}>
                          <span style={{ color: '#9ca3af', fontFamily: font, fontSize: '11px', letterSpacing: '1px', width: '44px', textAlign: 'center' }}>P</span>
                          <span style={{ color: '#9ca3af', fontFamily: font, fontSize: '11px', letterSpacing: '1px', width: '44px', textAlign: 'center' }}>MF</span>
                        </div>
                      </div>

                      {/* Rows */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        {visibleStandings.map((s) => {
                          const isFagerborg = s.team_name.toLowerCase().includes('fagerborg');
                          return (
                            <div
                              key={s.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                height: `${rowH}px`,
                                padding: '0 12px',
                                borderRadius: '6px',
                                background: isFagerborg
                                  ? 'rgba(220, 38, 38, 0.12)'
                                  : 'rgba(255,255,255,0.06)',
                                border: isFagerborg
                                  ? '1.5px solid rgba(239, 68, 68, 0.5)'
                                  : '1px solid rgba(255,255,255,0.08)',
                              }}
                            >
                              {/* Position number */}
                              <span style={{
                                color: isFagerborg ? '#f87171' : '#d1d5db',
                                fontFamily: font, fontSize: '16px', fontWeight: 700,
                                width: '28px', textAlign: 'center', flexShrink: 0,
                              }}>
                                {s.position}
                              </span>

                              {/* Club logo */}
                              <div style={{
                                width: '26px', height: '26px', marginLeft: '10px', marginRight: '12px',
                                flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                {s.logo_url ? (
                                  <img src={s.logo_url} alt=""
                                    style={{ maxWidth: '26px', maxHeight: '26px', objectFit: 'contain' }} />
                                ) : (
                                  <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(255,255,255,0.12)' }} />
                                )}
                              </div>

                              {/* Team name */}
                              <span style={{
                                color: isFagerborg ? '#ffffff' : '#e5e7eb',
                                fontFamily: font, fontSize: '14px',
                                fontWeight: isFagerborg ? 700 : 500,
                                flex: 1, textTransform: 'uppercase', letterSpacing: '0.5px',
                              }}>
                                {s.team_name}
                              </span>

                              {/* Points */}
                              <span style={{
                                color: isFagerborg ? '#ffffff' : '#e5e7eb',
                                fontFamily: font, fontSize: '16px', fontWeight: 700,
                                width: '44px', textAlign: 'center',
                              }}>
                                {s.points}
                              </span>

                              {/* Goal difference */}
                              <span style={{
                                color: isFagerborg ? '#f87171' : '#9ca3af',
                                fontFamily: font, fontSize: '14px', fontWeight: 600,
                                width: '44px', textAlign: 'center',
                              }}>
                                {s.goal_difference > 0 ? `+${s.goal_difference}` : s.goal_difference}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Footer */}
                      <p style={{
                        color: '#6b7280', fontFamily: font, fontSize: '10px',
                        letterSpacing: '2px', textAlign: 'center', marginTop: '14px',
                        textTransform: 'uppercase',
                      }}>
                        FAGERBORG BALLKLUB
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                        <img src={fagerborgLogo} alt="" style={{ width: '32px', height: '32px', opacity: 0.3 }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row gap-2 w-full max-w-md">
                  <Button onClick={handleInstagramStory} disabled={isGenerating} variant="outline" className="flex-1">
                    {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Instagram className="h-4 w-4 mr-2" />}
                    {isGenerating ? 'Genererer...' : 'Instagram Story'}
                  </Button>
                  {canShare && (
                    <Button onClick={handleShare} disabled={isGenerating} variant="outline" className="flex-1">
                      {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Share2 className="h-4 w-4 mr-2" />}
                      {isGenerating ? 'Genererer...' : 'Del bilde'}
                    </Button>
                  )}
                  <Button onClick={handleDownload} disabled={isGenerating} className="flex-1">
                    {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                    {isGenerating ? 'Genererer...' : 'Last ned'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
