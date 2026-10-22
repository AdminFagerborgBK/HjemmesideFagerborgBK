import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, FileText, Image as ImageIcon, Sparkles, Upload, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import fagerborgLogo from '@/assets/fagerborg-logo.png';

// A4 @ 300 DPI = 2480 x 3508
const POSTER_W = 2480;
const POSTER_H = 3508;

const ORG_NUMBER = '996145530';
const BASE_URL = `https://www.norsk-tipping.no/grasrotandelen/din-mottaker/${ORG_NUMBER}`;
// UTM-parametre slik at trafikk fra plakat kan spores i Norsk Tipping / analytics
const UTM_PARAMS =
  '?utm_source=fagerborgbk&utm_medium=poster&utm_campaign=grasrot';
const QR_URL = `${BASE_URL}${UTM_PARAMS}`;
// Kortere, lesbar visning på plakaten (samme destinasjon)
const DISPLAY_URL = `norsk-tipping.no/grasrotandelen/din-mottaker/${ORG_NUMBER}`;

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const wrapText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] => {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
};

const GrasrotPosterGenerator = () => {
  const { toast } = useToast();
  const previewRef = useRef<HTMLCanvasElement>(null);

  const [mode, setMode] = useState<'template' | 'custom'>('template');
  const [headline, setHeadline] = useState('BLI GRASROTGIVER');
  const [subheadline, setSubheadline] = useState('Velg Fagerborg BK som din grasrotmottaker hos Norsk Tipping. 7 % av spillinnsatsen din går direkte til klubben – det koster deg ingenting!');
  const [companyName, setCompanyName] = useState('');
  const [callToAction, setCallToAction] = useState('Skann QR-koden – eller besøk lenken under');
  const [customBgUrl, setCustomBgUrl] = useState<string>('');
  const [generating, setGenerating] = useState(false);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCustomBgUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const renderPoster = async (canvas: HTMLCanvasElement) => {
    canvas.width = POSTER_W;
    canvas.height = POSTER_H;
    const ctx = canvas.getContext('2d')!;

    // ------------------------------------------------------------------
    //  Helper: rounded rect
    // ------------------------------------------------------------------
    const roundedRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };

    // ------------------------------------------------------------------
    //  Background
    // ------------------------------------------------------------------
    if (mode === 'custom' && customBgUrl) {
      const bg = await loadImage(customBgUrl);
      const scale = Math.max(POSTER_W / bg.width, POSTER_H / bg.height);
      const w = bg.width * scale;
      const h = bg.height * scale;
      ctx.drawImage(bg, (POSTER_W - w) / 2, (POSTER_H - h) / 2, w, h);
      // Strong dark navy overlay for readability
      ctx.fillStyle = 'rgba(7, 20, 45, 0.72)';
      ctx.fillRect(0, 0, POSTER_W, POSTER_H);
      // Extra darkening at top and bottom for text contrast
      const topGrad = ctx.createLinearGradient(0, 0, 0, POSTER_H * 0.45);
      topGrad.addColorStop(0, 'rgba(0,0,0,0.55)');
      topGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = topGrad;
      ctx.fillRect(0, 0, POSTER_W, POSTER_H * 0.45);
      const botGrad = ctx.createLinearGradient(0, POSTER_H * 0.55, 0, POSTER_H);
      botGrad.addColorStop(0, 'rgba(0,0,0,0)');
      botGrad.addColorStop(1, 'rgba(0,0,0,0.65)');
      ctx.fillStyle = botGrad;
      ctx.fillRect(0, POSTER_H * 0.55, POSTER_W, POSTER_H * 0.45);
    } else {
      const grad = ctx.createLinearGradient(0, 0, POSTER_W, POSTER_H);
      grad.addColorStop(0, '#0a1f44');
      grad.addColorStop(0.55, '#13306b');
      grad.addColorStop(1, '#1e4a9e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, POSTER_W, POSTER_H);

      const radial = ctx.createRadialGradient(
        POSTER_W * 0.2, POSTER_H * 0.15, 100,
        POSTER_W * 0.2, POSTER_H * 0.15, POSTER_W * 0.7,
      );
      radial.addColorStop(0, 'rgba(34, 197, 94, 0.22)');
      radial.addColorStop(1, 'rgba(34, 197, 94, 0)');
      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, POSTER_W, POSTER_H);
    }

    // ------------------------------------------------------------------
    //  Top bar: Fagerborg logo + Grasrotandelen / Norsk Tipping lockup
    // ------------------------------------------------------------------
    try {
      const logo = await loadImage(fagerborgLogo);
      const logoH = 300;
      const logoW = (logo.width / logo.height) * logoH;
      ctx.drawImage(logo, (POSTER_W - logoW) / 2, 170, logoW, logoH);
    } catch (e) {
      // ignore
    }

    // Grasrotandelen badge (pill) — Norsk Tipping grasrot green
    const badgeText = 'GRASROTANDELEN';
    const badgeSub = 'Norsk Tipping';
    ctx.font = '800 62px Montserrat, sans-serif';
    const badgeTextW = ctx.measureText(badgeText).width;
    const badgePadX = 70;
    const badgeW = badgeTextW + badgePadX * 2;
    const badgeH = 130;
    const badgeX = (POSTER_W - badgeW) / 2;
    const badgeY = 540;

    // Outer subtle glow
    ctx.shadowColor = 'rgba(0, 151, 60, 0.45)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = '#00973C'; // Norsk Tipping grasrot green
    roundedRect(badgeX, badgeY, badgeW, badgeH, 65);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Small leaf dot
    ctx.fillStyle = '#7CFFB3';
    ctx.beginPath();
    ctx.arc(badgeX + 42, badgeY + badgeH / 2, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 62px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, badgeX + badgeW / 2 + 18, badgeY + badgeH / 2);
    ctx.textBaseline = 'alphabetic';

    // "Norsk Tipping" subtitle under pill
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '600 42px Montserrat, sans-serif';
    ctx.fillText(`via ${badgeSub}`, POSTER_W / 2, badgeY + badgeH + 70);

    // ------------------------------------------------------------------
    //  Headline
    // ------------------------------------------------------------------
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 210px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    // text shadow for legibility on photo bg
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 6;
    const headlineLines = wrapText(ctx, headline.toUpperCase(), POSTER_W - 280);
    let y = 1020;
    for (const line of headlineLines) {
      ctx.fillText(line, POSTER_W / 2, y);
      y += 230;
    }
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Green underline accent
    ctx.fillStyle = '#00973C';
    roundedRect(POSTER_W / 2 - 180, y - 100, 360, 16, 8);
    ctx.fill();
    y += 70;

    // ------------------------------------------------------------------
    //  Subheadline (with dark backing panel for photo bg)
    // ------------------------------------------------------------------
    ctx.font = '500 62px Montserrat, sans-serif';
    const subLines = wrapText(ctx, subheadline, POSTER_W - 380);
    const subBlockH = subLines.length * 88 + 60;
    if (mode === 'custom' && customBgUrl) {
      ctx.fillStyle = 'rgba(7, 20, 45, 0.55)';
      roundedRect(180, y - 70, POSTER_W - 360, subBlockH, 32);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 2;
    let subY = y;
    for (const line of subLines) {
      ctx.fillText(line, POSTER_W / 2, subY);
      subY += 88;
    }
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    y = subY;

    // Company greeting
    if (companyName.trim()) {
      y += 30;
      ctx.fillStyle = '#7CFFB3';
      ctx.font = '700 70px Montserrat, sans-serif';
      ctx.fillText(`Hilsen ${companyName}`, POSTER_W / 2, y);
    }

    // ------------------------------------------------------------------
    //  QR card
    // ------------------------------------------------------------------
    const qrSize = 780;
    const qrPadding = 70;
    const cardSize = qrSize + qrPadding * 2;
    const cardX = (POSTER_W - cardSize) / 2;
    const cardY = POSTER_H - cardSize - 580;

    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 70;
    ctx.shadowOffsetY = 24;
    ctx.fillStyle = '#ffffff';
    roundedRect(cardX, cardY, cardSize, cardSize, 44);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    const qrDataUrl = await QRCode.toDataURL(QR_URL, {
      width: qrSize,
      margin: 0,
      errorCorrectionLevel: 'H',
      color: { dark: '#00973C', light: '#ffffff' },
    });
    const qrImg = await loadImage(qrDataUrl);
    ctx.drawImage(qrImg, cardX + qrPadding, cardY + qrPadding, qrSize, qrSize);

    // ------------------------------------------------------------------
    //  CTA under QR
    // ------------------------------------------------------------------
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 70px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 14;
    ctx.fillText(callToAction, POSTER_W / 2, cardY + cardSize + 130);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // ------------------------------------------------------------------
    //  Link pill — large, clearly readable, looks clickable
    // ------------------------------------------------------------------
    ctx.font = '700 58px Montserrat, sans-serif';
    const linkTextW = ctx.measureText(DISPLAY_URL).width;
    const pillPadX = 60;
    const pillW = linkTextW + pillPadX * 2;
    const pillH = 130;
    const pillX = (POSTER_W - pillW) / 2;
    const pillY = cardY + cardSize + 190;

    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = '#ffffff';
    roundedRect(pillX, pillY, pillW, pillH, 65);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Green border
    ctx.strokeStyle = '#00973C';
    ctx.lineWidth = 6;
    roundedRect(pillX, pillY, pillW, pillH, 65);
    ctx.stroke();

    ctx.fillStyle = '#00973C';
    ctx.font = '800 58px Montserrat, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(DISPLAY_URL, POSTER_W / 2, pillY + pillH / 2 + 4);
    ctx.textBaseline = 'alphabetic';

    // Save pill coords for PDF link annotation
    (canvas as any).__linkRect = { x: pillX, y: pillY, w: pillW, h: pillH };

    // Org.nr
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '500 36px Montserrat, sans-serif';
    ctx.fillText(`Fagerborg BK • Org.nr ${ORG_NUMBER}`, POSTER_W / 2, pillY + pillH + 70);

    // Footer
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '600 40px Montserrat, sans-serif';
    ctx.fillText('Koster deg ingenting – gir klubben alt 💚', POSTER_W / 2, POSTER_H - 110);
  };

  const updatePreview = async () => {
    if (!previewRef.current) return;
    setGenerating(true);
    try {
      await renderPoster(previewRef.current);
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    updatePreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, headline, subheadline, companyName, callToAction, customBgUrl]);

  const handleDownload = async () => {
    setGenerating(true);
    try {
      const canvas = document.createElement('canvas');
      await renderPoster(canvas);
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      const safeName = companyName ? companyName.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'grasrot';
      a.download = `fagerborg-grasrot-poster-${safeName}.png`;
      a.click();
      toast({ title: 'Plakat lastet ned', description: 'A4 PNG i 300 DPI – klar til utskrift eller e-post.' });
    } catch (err: any) {
      toast({ title: 'Feil', description: err.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPdf = async () => {
    setGenerating(true);
    try {
      const canvas = document.createElement('canvas');
      await renderPoster(canvas);
      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pageW = 210;
      const pageH = 297;
      pdf.addImage(imgData, 'JPEG', 0, 0, pageW, pageH);

      // Clickable link annotation over the URL pill
      const rect = (canvas as any).__linkRect as { x: number; y: number; w: number; h: number } | undefined;
      if (rect) {
        const sx = pageW / POSTER_W;
        const sy = pageH / POSTER_H;
        pdf.link(rect.x * sx, rect.y * sy, rect.w * sx, rect.h * sy, { url: QR_URL });
      }
      // Also make the QR area clickable
      const qrCardSize = 920;
      const qrCardX = (POSTER_W - qrCardSize) / 2;
      const qrCardY = POSTER_H - qrCardSize - 580;
      pdf.link(
        qrCardX * (pageW / POSTER_W),
        qrCardY * (pageH / POSTER_H),
        qrCardSize * (pageW / POSTER_W),
        qrCardSize * (pageH / POSTER_H),
        { url: QR_URL },
      );

      const safeName = companyName ? companyName.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'grasrot';
      pdf.save(`fagerborg-grasrot-poster-${safeName}.pdf`);
      toast({ title: 'PDF lastet ned', description: 'A4 PDF med klikkbar lenke til Norsk Tipping.' });
    } catch (err: any) {
      toast({ title: 'Feil', description: err.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Plakat-generator – Grasrotandelen (A4 PNG)
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Lag plakater rettet mot grasrotgivere med QR-kode rett til Fagerborg BK hos Norsk Tipping.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="template">
                  <Sparkles className="h-4 w-4 mr-2" /> Mal
                </TabsTrigger>
                <TabsTrigger value="custom">
                  <ImageIcon className="h-4 w-4 mr-2" /> Egen bakgrunn
                </TabsTrigger>
              </TabsList>
              <TabsContent value="custom" className="pt-4">
                <Label className="block mb-2">Last opp bakgrunnsbilde</Label>
                <div className="flex items-center gap-2">
                  <Input type="file" accept="image/*" onChange={handleUpload} />
                  <Upload className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Anbefalt: stort bilde (minst 2000px bredt). Vi legger på mørk overlay for lesbarhet.
                </p>
              </TabsContent>
            </Tabs>

            <div>
              <Label>Overskrift</Label>
              <Input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={40} />
            </div>
            <div>
              <Label>Undertittel</Label>
              <Textarea
                value={subheadline}
                onChange={(e) => setSubheadline(e.target.value)}
                rows={4}
                maxLength={240}
              />
            </div>
            <div>
              <Label>Bedriftsnavn (valgfritt)</Label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="F.eks. Brasserie Blanche"
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground mt-1">Vises som "Hilsen [navn]" på plakaten.</p>
            </div>
            <div>
              <Label>Oppfordring (over QR)</Label>
              <Input
                value={callToAction}
                onChange={(e) => setCallToAction(e.target.value)}
                maxLength={60}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button onClick={handleDownload} disabled={generating} size="lg">
                {generating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                PNG (300 DPI)
              </Button>
              <Button onClick={handleDownloadPdf} disabled={generating} size="lg" variant="secondary">
                {generating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                PDF (klikkbar lenke)
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              PDF-versjonen har klikkbar lenke til Norsk Tipping (med UTM-sporing) – perfekt for e-post og digital deling. PNG passer best til print og sosiale medier.
            </p>
          </div>

          <div className="bg-muted rounded-lg p-4 flex items-center justify-center">
            <canvas
              ref={previewRef}
              className="max-w-full h-auto shadow-lg rounded"
              style={{ aspectRatio: '2480 / 3508', width: '100%', maxWidth: 360 }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default GrasrotPosterGenerator;