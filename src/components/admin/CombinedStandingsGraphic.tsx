import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, Image, Loader2, Share2, Instagram } from 'lucide-react';
import { useStandings, Standing } from '@/hooks/useStandings';
import { toast } from 'sonner';
import standingsBgFallback from '@/assets/standings-bg.jpg';
import fagerborgLogo from '@/assets/fagerborg-logo.png';
import { useDefaultBackground } from '@/hooks/useGraphicBackgrounds';

const font = 'Arial, Helvetica, sans-serif';

function getVisible(standings: Standing[] | undefined): Standing[] {
  if (!standings || standings.length === 0) return [];
  const fbStanding = standings.find((s) => s.team_name.toLowerCase().includes('fagerborg'));
  const fbPos = fbStanding?.position ?? 0;
  if (fbPos <= 5) return standings.slice(0, 5);
  const idx = standings.findIndex((s) => s.team_name.toLowerCase().includes('fagerborg'));
  if (idx === -1) return standings.slice(0, 5);
  const start = Math.max(0, idx - 2);
  return standings.slice(start, start + 5);
}

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  const img = new window.Image();
  img.crossOrigin = 'anonymous';
  img.src = src;
  await new Promise<void>((resolve) => {
    if (img.complete && img.naturalWidth > 0) { resolve(); return; }
    img.onload = () => resolve();
    img.onerror = () => resolve();
  });
  return img.naturalWidth > 0 ? img : null;
}

async function loadLogoMap(standings: Standing[]): Promise<Map<string, HTMLImageElement>> {
  const map = new Map<string, HTMLImageElement>();
  await Promise.all(standings.map(async (s) => {
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
      const img = await loadImage(dataUrl);
      if (img) map.set(s.id, img);
    } catch { /* ignore */ }
  }));
  return map;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, rw: number, rh: number, r: number) {
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
}

function drawSection(
  ctx: CanvasRenderingContext2D,
  standings: Standing[],
  logoImages: Map<string, HTMLImageElement>,
  label: string,
  league: string,
  season: string,
  x: number,
  y: number,
  sectionW: number,
) {
  const rowH = 38;
  const gapSize = 4;
  const pad = 12;
  const innerW = sectionW - 2 * pad;

  // Section title
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 14px ${font}`;
  ctx.fillText(label.toUpperCase(), x + pad + 4, y + 10);

  // League / season
  ctx.fillStyle = '#9ca3af';
  ctx.font = `10px ${font}`;
  ctx.fillText(`${league} · ${season}`, x + pad + 4, y + 28);

  // Column headers
  ctx.textAlign = 'center';
  ctx.font = `10px ${font}`;
  ctx.fillText('P', x + sectionW - pad - 12 - 38 - 18, y + 28);
  ctx.fillText('MF', x + sectionW - pad - 12 - 18, y + 28);

  const firstRowY = y + 42;

  standings.forEach((s, i) => {
    const isFB = s.team_name.toLowerCase().includes('fagerborg');
    const ry = firstRowY + i * (rowH + gapSize);
    const cy = ry + rowH / 2;

    roundRect(ctx, x + pad, ry, innerW, rowH, 5);
    ctx.fillStyle = isFB ? 'rgba(220,38,38,0.12)' : 'rgba(255,255,255,0.06)';
    ctx.fill();
    ctx.strokeStyle = isFB ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)';
    ctx.lineWidth = isFB ? 1.5 : 1;
    ctx.stroke();

    // Position
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = isFB ? '#f87171' : '#d1d5db';
    ctx.font = `bold 14px ${font}`;
    ctx.fillText(String(s.position), x + pad + 10 + 12, cy);

    // Logo
    const logoImg = logoImages.get(s.id);
    if (logoImg) {
      const logoSize = 22;
      const logoX = x + pad + 10 + 24 + 8;
      const logoY = cy - logoSize / 2;
      const lr = Math.min(logoSize / logoImg.naturalWidth, logoSize / logoImg.naturalHeight);
      const lw = logoImg.naturalWidth * lr;
      const lh = logoImg.naturalHeight * lr;
      ctx.drawImage(logoImg, logoX + (logoSize - lw) / 2, logoY + (logoSize - lh) / 2, lw, lh);
    }

    // Team name
    ctx.textAlign = 'left';
    ctx.fillStyle = isFB ? '#ffffff' : '#e5e7eb';
    ctx.font = `${isFB ? 'bold' : '500'} 12px ${font}`;
    ctx.fillText(s.team_name.toUpperCase(), x + pad + 10 + 24 + 8 + 22 + 8, cy);

    // Points
    ctx.textAlign = 'center';
    ctx.fillStyle = isFB ? '#ffffff' : '#e5e7eb';
    ctx.font = `bold 14px ${font}`;
    ctx.fillText(String(s.points), x + sectionW - pad - 12 - 38 - 18, cy);

    // Goal difference
    ctx.fillStyle = isFB ? '#f87171' : '#9ca3af';
    ctx.font = `600 12px ${font}`;
    const gdText = s.goal_difference > 0 ? `+${s.goal_difference}` : String(s.goal_difference);
    ctx.fillText(gdText, x + sectionW - pad - 12 - 18, cy);
  });

  return firstRowY + standings.length * (rowH + gapSize);
}

export function CombinedStandingsGraphic() {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [storyMode, setStoryMode] = useState(false);
  const { data: standingsA } = useStandings('A-laget');
  const { data: standingsB } = useStandings('B-laget');
  const { data: defaultBg } = useDefaultBackground();
  const bgSrc = defaultBg?.image_url || standingsBgFallback;

  const visA = getVisible(standingsA);
  const visB = getVisible(standingsB);

  const fbA = standingsA?.find((s) => s.team_name.toLowerCase().includes('fagerborg'));
  const fbB = standingsB?.find((s) => s.team_name.toLowerCase().includes('fagerborg'));

  const fileName = `tabell-samlet-${new Date().toISOString().split('T')[0]}.png`;

  const generateImage = async (): Promise<Blob | null> => {
    const w = storyMode ? 540 : 600;
    const rowH = 38;
    const gapSize = 4;
    const sectionHeaderH = 46;
    const sectionAH = sectionHeaderH + visA.length * (rowH + gapSize);
    const sectionBH = sectionHeaderH + visB.length * (rowH + gapSize);
    const dividerGap = 20;
    const footerH = 70;
    const bottomPad = storyMode ? 50 : 30;
    const tableAreaH = sectionAH + dividerGap + sectionBH + footerH;
    const h = storyMode ? 960 : Math.max(600, tableAreaH + 200);

    const scale = 4;
    const cvs = document.createElement('canvas');
    cvs.width = w * scale;
    cvs.height = h * scale;
    const ctx = cvs.getContext('2d')!;
    ctx.scale(scale, scale);

    // 1. Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, w, h);

    // 2. Background image
    try {
      const bgImg = await loadImage(bgSrc);
      if (bgImg) {
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

    // 3. Gradient
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

    // 4. Load logos
    const allStandings = [...visA, ...visB];
    const logoImages = await loadLogoMap(allStandings);

    // 5. Draw sections
    const sectionStartY = h - bottomPad - tableAreaH;

    const endA = drawSection(
      ctx, visA, logoImages, 'A-laget',
      fbA?.league || '', fbA?.season || new Date().getFullYear().toString(),
      0, sectionStartY, w,
    );

    // Divider line
    const divY = endA + dividerGap / 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(36, divY);
    ctx.lineTo(w - 36, divY);
    ctx.stroke();

    drawSection(
      ctx, visB, logoImages, 'B-laget',
      fbB?.league || '', fbB?.season || new Date().getFullYear().toString(),
      0, endA + dividerGap, w,
    );

    // 6. Footer
    const footerY = h - bottomPad - 8;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#6b7280';
    ctx.font = `10px ${font}`;
    ctx.fillText('FAGERBORG BALLKLUB', w / 2, footerY);

    // 7. Logo
    try {
      const logo = await loadImage(fagerborgLogo);
      if (logo) {
        const logoSize = 32;
        ctx.globalAlpha = 0.3;
        ctx.drawImage(logo, w / 2 - logoSize / 2, footerY + 10, logoSize, logoSize);
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
          await navigator.share({ files: [file], title: 'Tabell: Samlet' });
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
        await navigator.share({ files: [file], title: 'Tabell: Samlet' }); toast.success('Delt!');
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
        await navigator.share({ files: [file], title: 'Tabell: Samlet' }); toast.success('Delt!');
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

  if ((!standingsA || standingsA.length === 0) && (!standingsB || standingsB.length === 0)) return null;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        <Image className="h-4 w-4 mr-2" />
        Samlet tabell
      </Button>

      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tabellgrafikk – Samlet</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4">
            {generatedImageUrl ? (
              <div className="flex flex-col items-center gap-4 w-full">
                <p className="text-sm text-muted-foreground text-center">
                  Hold inne bildet nedenfor for å lagre det til kamerarullen
                </p>
                <img src={generatedImageUrl} alt="Samlet tabellgrafikk" className="max-w-full rounded-lg shadow-lg" style={{ maxHeight: '60vh' }} />
                <Button variant="outline" onClick={() => setGeneratedImageUrl(null)} className="w-full max-w-xs">
                  Generer på nytt
                </Button>
              </div>
            ) : (
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
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
