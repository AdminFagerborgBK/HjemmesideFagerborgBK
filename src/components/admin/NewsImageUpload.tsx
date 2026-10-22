import { useState, useRef, useEffect, useCallback } from 'react';
import { useMediaUpload } from '@/hooks/useMediaUpload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  Upload, X, Loader2, Image as ImageIcon, Check, AlertTriangle,
  Crop, Maximize, Wand2, Info,
} from 'lucide-react';
import {
  getImageMeta, generateVariants, generatePreview,
  formatFileSize, formatRatio,
  TARGET_RATIO, TARGET_RATIO_LABEL, RATIO_TOLERANCE, VARIANT_WIDTHS,
  type ImageMeta, type CropMode,
} from '@/lib/imageProcessing';
import { useToast } from '@/hooks/use-toast';

interface NewsImageUploadProps {
  value: string | null;
  onChange: (url: string | null) => void;
  onFocalYChange?: (y: number) => void;
  focalY?: number;
  className?: string;
}

type Step = 'idle' | 'preview' | 'uploading';

export function NewsImageUpload({
  value,
  onChange,
  onFocalYChange,
  focalY = 50,
  className,
}: NewsImageUploadProps) {
  const { uploadMedia, uploading: hookUploading } = useMediaUpload();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Preview state
  const [step, setStep] = useState<Step>(value ? 'idle' : 'idle');
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<ImageMeta | null>(null);
  const [cropMode, setCropMode] = useState<CropMode>('crop');
  const [localFocalY, setLocalFocalY] = useState(focalY / 100); // 0-1
  const [previewCard, setPreviewCard] = useState<string | null>(null);
  const [previewHero, setPreviewHero] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Sync focalY prop
  useEffect(() => { setLocalFocalY(focalY / 100); }, [focalY]);

  const updatePreviews = useCallback(async (f: File, mode: CropMode, fy: number) => {
    try {
      // For 'keep' mode, just resize without crop
      // For 'crop' mode, crop to target ratio using focal point
      const [card, hero] = await Promise.all([
        generatePreview(f, 400, 'crop', fy),
        generatePreview(f, 800, mode === 'crop' ? 'crop' : 'keep', fy),
      ]);
      setPreviewCard(card);
      setPreviewHero(hero);
    } catch {
      // silently fail preview
    }
  }, []);

  const handleFileSelected = async (f: File) => {
    if (!f.type.startsWith('image/')) return;
    setFile(f);
    setStep('preview');
    // Reset focal point to center for new uploads
    const defaultFocal = 0.5;
    setLocalFocalY(defaultFocal);
    onFocalYChange?.(50);

    try {
      const m = await getImageMeta(f);
      setMeta(m);
      // Default to 'keep' so the full image is preserved; user can switch to 'crop' if desired
      setCropMode('keep');
      await updatePreviews(f, 'keep', defaultFocal);
    } catch {
      toast({ title: 'Kunne ikke lese bildet', variant: 'destructive' });
      setStep('idle');
    }
  };

  const handleModeChange = async (mode: CropMode) => {
    setCropMode(mode);
    if (file) await updatePreviews(file, mode, localFocalY);
  };

  const handleFocalChange = async (fy: number) => {
    setLocalFocalY(fy);
    onFocalYChange?.(Math.round(fy * 100));
    if (file) await updatePreviews(file, cropMode, fy);
  };

  const handleAutoFix = async () => {
    setCropMode('crop');
    if (file) await updatePreviews(file, 'crop', localFocalY);
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsProcessing(true);
    setStep('uploading');

    try {
      // 1. Upload original
      const ext = file.name.split('.').pop() || 'jpg';
      const baseName = `news/${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const originalName = `${baseName}_original.${ext}`;

      const originalBlob = file;
      const originalFile = new File([originalBlob], originalName.split('/').pop()!, { type: file.type });

      // Upload original via hook (it handles the storage path internally)
      // We'll upload directly to get clean naming
      const { supabase } = await import('@/integrations/supabase/client');

      const uploadToStorage = async (path: string, blob: Blob, contentType: string) => {
        const { error } = await supabase.storage
          .from('site-media')
          .upload(path, blob, { cacheControl: '31536000', upsert: false, contentType });
        if (error) throw error;
        const { data } = supabase.storage.from('site-media').getPublicUrl(path);
        return data.publicUrl;
      };

      // Upload original
      await uploadToStorage(originalName, file, file.type);

      // 2. Generate and upload variants
      const variants = await generateVariants({ file, mode: cropMode, focalY: localFocalY });

      let primaryUrl = '';
      let primaryWidth = 0;

      for (const v of variants) {
        const variantPath = `${baseName}_${v.suffix}`;
        const mimeMap: Record<string, string> = { webp: 'image/webp', jpeg: 'image/jpeg', png: 'image/png' };
        const url = await uploadToStorage(variantPath, v.blob, mimeMap[v.format]);

        // Pick the largest non-webp variant as primary URL
        if (v.format !== 'webp' && v.width > primaryWidth) {
          primaryUrl = url;
          primaryWidth = v.width;
        }
      }

      // Add cache-buster
      primaryUrl = `${primaryUrl}?t=${Date.now()}`;
      onChange(primaryUrl);

      toast({
        title: 'Bilde lastet opp',
        description: `${variants.length} varianter generert (${VARIANT_WIDTHS.filter(w => w <= (meta?.width ?? 9999) * 1.1).length} størrelser)`,
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Opplasting feilet',
        description: error instanceof Error ? error.message : 'Ukjent feil',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setStep('idle');
      setFile(null);
      setMeta(null);
    }
  };

  const handleCancel = () => {
    setStep('idle');
    setFile(null);
    setMeta(null);
    setPreviewCard(null);
    setPreviewHero(null);
  };

  const handleRemove = () => {
    onChange(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelected(f);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFileSelected(f);
    e.target.value = '';
  };

  // ── Existing image view ──
  if (value && step === 'idle') {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="relative">
          <img
            src={value}
            alt="Nyhetsbilde"
            className="w-full h-48 object-cover rounded-lg border"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2"
            onClick={handleRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4 mr-2" />
          Bytt bilde
        </Button>
        <Input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleInputChange}
          className="hidden"
        />
      </div>
    );
  }

  // ── Preview / crop step ──
  if (step === 'preview' && meta && file) {
    return (
      <div className={`space-y-4 ${className}`}>
        {/* Meta info */}
        <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Bildeinfo</span>
            {meta.isAcceptable ? (
              <Badge variant="outline" className="border-green-600 text-green-700 dark:text-green-400">
                <Check className="h-3 w-3 mr-1" /> OK ratio
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-600 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3 mr-1" /> Avvik
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
            <span>Oppløsning: {meta.width} × {meta.height}</span>
            <span>Størrelse: {formatFileSize(meta.fileSize)}</span>
            <span>Ratio: {formatRatio(meta.ratio)}</span>
            <span>Anbefalt: {TARGET_RATIO_LABEL}</span>
          </div>
          {!meta.isAcceptable && (
            <p className="text-xs text-destructive flex items-start gap-1">
              <Info className="h-3 w-3 mt-0.5 shrink-0" />
              Bildet avviker {(meta.ratioDiff * 100).toFixed(0)}% fra anbefalt format.
              Velg hvordan du vil håndtere det:
            </p>
          )}
        </div>

        {/* Mode buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={cropMode === 'crop' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleModeChange('crop')}
          >
            <Crop className="h-4 w-4 mr-1" />
            Crop
          </Button>
          <Button
            type="button"
            variant={cropMode === 'keep' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleModeChange('keep')}
          >
            <Maximize className="h-4 w-4 mr-1" />
            Behold hele
          </Button>
          {!meta.isAcceptable && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAutoFix}
            >
              <Wand2 className="h-4 w-4 mr-1" />
              Auto
            </Button>
          )}
        </div>

        {/* Focal point slider — always visible */}
        <div className="space-y-1">
          <Label className="text-xs">Fokuspunkt (topp ↔ bunn)</Label>
          <Slider
            value={[localFocalY * 100]}
            onValueChange={([v]) => handleFocalChange(v / 100)}
            min={0}
            max={100}
            step={1}
          />
        </div>

        {/* Preview panels */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nyhetskort</Label>
            <div className="aspect-[4/3] bg-muted rounded-md overflow-hidden border">
              {previewCard ? (
                <img
                  src={previewCard}
                  alt="Kortvisning"
                  className="w-full h-full object-cover"
                  style={{ objectPosition: `center ${localFocalY * 100}%` }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nyhetsside (hero)</Label>
            <div className="aspect-[16/9] bg-muted rounded-md overflow-hidden border">
              {previewHero ? (
                <img
                  src={previewHero}
                  alt="Herovisning"
                  className={`w-full h-full ${cropMode === 'keep' ? 'object-contain' : 'object-cover'}`}
                  style={{ objectPosition: `center ${localFocalY * 100}%` }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Variant info */}
        <p className="text-xs text-muted-foreground">
          Varianter som genereres: {VARIANT_WIDTHS.filter(w => w <= meta.width * 1.1).join(', ')}px
          — JPEG/PNG + WebP. Original bevares separat.
        </p>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            type="button"
            className="flex-1"
            onClick={handleUpload}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Genererer & laster opp...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Last opp
              </>
            )}
          </Button>
          <Button type="button" variant="outline" onClick={handleCancel} disabled={isProcessing}>
            Avbryt
          </Button>
        </div>
      </div>
    );
  }

  // ── Upload progress ──
  if (step === 'uploading') {
    return (
      <div className={`border-2 border-dashed rounded-lg p-8 text-center ${className}`}>
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium">Genererer varianter og laster opp...</p>
          <p className="text-xs text-muted-foreground">Original + {VARIANT_WIDTHS.length} størrelser × 2 formater</p>
        </div>
      </div>
    );
  }

  // ── Drop zone ──
  return (
    <div className={className}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'}
        `}
      >
        <div className="flex flex-col items-center gap-2">
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Dra og slipp et bilde, eller klikk for å velge
          </p>
          <p className="text-xs text-muted-foreground">
            Anbefalt: {TARGET_RATIO_LABEL} px ({formatRatio(TARGET_RATIO)})
          </p>
        </div>
      </div>
      <Input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        className="hidden"
      />
    </div>
  );
}
