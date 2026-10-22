import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Image as ImageIcon, Sparkles, Upload, Loader2 } from 'lucide-react';
import { useSportsSeason } from '@/hooks/useSportsSeason';
import { useToast } from '@/hooks/use-toast';
import fagerborgLogo from '@/assets/fagerborg-logo.png';

// A4 @ 300 DPI = 2480 x 3508
const POSTER_W = 2480;
const POSTER_H = 3508;

const QR_URL = 'https://fagerborgbk.no/malklubben';

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

const GoalClubPosterGenerator = () => {
  const {data:config}=useSportsSeason();
  const season=config?.season;
  const { toast } = useToast();
  const previewRef = useRef<HTMLCanvasElement>(null);

  const [mode, setMode] = useState<'template' | 'custom'>('template');
  const [headline, setHeadline] = useState('MÅLKLUBBEN');
  const [subheadline, setSubheadline] = useState('Bli med å støtte Fagerborg BK – per mål vi scorer!');
  const [companyName, setCompanyName] = useState('');
  const [callToAction, setCallToAction] = useState('Skann QR-koden og meld deg på');
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
    const ctx = canvas.getContext('2d');
    if(!ctx || !season) return;

    // --- Background ---
    if (mode === 'custom' && customBgUrl) {
      const bg = await loadImage(customBgUrl);
      // cover
      const scale = Math.max(POSTER_W / bg.width, POSTER_H / bg.height);
      const w = bg.width * scale;
      const h = bg.height * scale;
      ctx.drawImage(bg, (POSTER_W - w) / 2, (POSTER_H - h) / 2, w, h);
      // dark overlay for readability
      ctx.fillStyle = 'rgba(10, 31, 68, 0.55)';
      ctx.fillRect(0, 0, POSTER_W, POSTER_H);
    } else {
      // Fagerborg navy gradient
      const grad = ctx.createLinearGradient(0, 0, POSTER_W, POSTER_H);
      grad.addColorStop(0, '#0a1f44');
      grad.addColorStop(0.55, '#13306b');
      grad.addColorStop(1, '#1e4a9e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, POSTER_W, POSTER_H);

      // Decorative radial highlight
      const radial = ctx.createRadialGradient(
        POSTER_W * 0.8, POSTER_H * 0.15, 100,
        POSTER_W * 0.8, POSTER_H * 0.15, POSTER_W * 0.7,
      );
      radial.addColorStop(0, 'rgba(255, 215, 0, 0.18)');
      radial.addColorStop(1, 'rgba(255, 215, 0, 0)');
      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, POSTER_W, POSTER_H);
    }

    // --- Logo top center ---
    try {
      const logo = await loadImage(fagerborgLogo);
      const logoH = 380;
      const logoW = (logo.width / logo.height) * logoH;
      ctx.drawImage(logo, (POSTER_W - logoW) / 2, 180, logoW, logoH);
    } catch (e) {
      // ignore logo failure
    }

    // --- Eyebrow tag ---
    ctx.fillStyle = '#FFD700';
    ctx.font = '600 56px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`SESONG ${season} • FAGERBORG BALLKLUBB`, POSTER_W / 2, 760);

    // --- Headline ---
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 220px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    const headlineLines = wrapText(ctx, headline.toUpperCase(), POSTER_W - 300);
    let y = 1020;
    for (const line of headlineLines) {
      ctx.fillText(line, POSTER_W / 2, y);
      y += 240;
    }

    // Yellow underline accent
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(POSTER_W / 2 - 200, y - 100, 400, 14);
    y += 80;

    // --- Subheadline ---
    ctx.fillStyle = '#ffffff';
    ctx.font = '500 70px Montserrat, sans-serif';
    const subLines = wrapText(ctx, subheadline, POSTER_W - 400);
    for (const line of subLines) {
      ctx.fillText(line, POSTER_W / 2, y);
      y += 96;
    }

    // --- Company name (if any) ---
    if (companyName.trim()) {
      y += 80;
      ctx.fillStyle = '#FFD700';
      ctx.font = '700 80px Montserrat, sans-serif';
      ctx.fillText(`Hilsen ${companyName}`, POSTER_W / 2, y);
    }

    // --- QR code with white card ---
    const qrSize = 760;
    const qrPadding = 70;
    const cardSize = qrSize + qrPadding * 2;
    const cardX = (POSTER_W - cardSize) / 2;
    const cardY = POSTER_H - cardSize - 460;

    // Card shadow
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 20;
    ctx.fillStyle = '#ffffff';
    // rounded rect
    const r = 40;
    ctx.beginPath();
    ctx.moveTo(cardX + r, cardY);
    ctx.arcTo(cardX + cardSize, cardY, cardX + cardSize, cardY + cardSize, r);
    ctx.arcTo(cardX + cardSize, cardY + cardSize, cardX, cardY + cardSize, r);
    ctx.arcTo(cardX, cardY + cardSize, cardX, cardY, r);
    ctx.arcTo(cardX, cardY, cardX + cardSize, cardY, r);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // QR into card
    const qrDataUrl = await QRCode.toDataURL(QR_URL, {
      width: qrSize,
      margin: 0,
      errorCorrectionLevel: 'H',
      color: { dark: '#0a1f44', light: '#ffffff' },
    });
    const qrImg = await loadImage(qrDataUrl);
    ctx.drawImage(qrImg, cardX + qrPadding, cardY + qrPadding, qrSize, qrSize);

    // --- Call to action below QR ---
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 78px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(callToAction, POSTER_W / 2, cardY + cardSize + 130);

    // URL
    ctx.fillStyle = '#FFD700';
    ctx.font = '600 60px Montserrat, sans-serif';
    ctx.fillText('fagerborgbk.no/malklubben', POSTER_W / 2, cardY + cardSize + 230);

    // Footer
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '500 42px Montserrat, sans-serif';
    ctx.fillText('Hver scoring teller. Hvert bidrag betyr noe. ⚽', POSTER_W / 2, POSTER_H - 110);
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

  // Re-render preview on input changes
  useEffect(() => {
    updatePreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season, mode, headline, subheadline, companyName, callToAction, customBgUrl]);

  const handleDownload = async () => {
    setGenerating(true);
    try {
      const canvas = document.createElement('canvas');
      await renderPoster(canvas);
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      const safeName = companyName ? companyName.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'malklubben';
      a.download = `fagerborg-malklubben-poster-${safeName}.png`;
      a.click();
      toast({ title: 'Plakat lastet ned', description: 'A4 PNG i 300 DPI – klar til utskrift eller e-post.' });
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
          Plakat-generator (A4 PNG)
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Lag plakater til bedrifter med QR-kode til Målklubben. Enten ferdig Fagerborg-design eller egen bakgrunn.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Controls */}
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
                rows={3}
                maxLength={200}
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

            <Button onClick={handleDownload} disabled={generating} className="w-full" size="lg">
              {generating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Last ned A4 PNG (300 DPI)
            </Button>
          </div>

          {/* Preview */}
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

export default GoalClubPosterGenerator;