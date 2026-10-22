import { useRef, useState } from 'react';
import { useMediaUpload } from '@/hooks/useMediaUpload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ImagePlus, Loader2 } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface ContentImageInsertProps {
  onInsert: (markdownTag: string) => void;
}

export function ContentImageInsert({ onInsert }: ContentImageInsertProps) {
  const { uploadMedia, uploading } = useMediaUpload();
  const fileRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState('');
  const [open, setOpen] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const url = await uploadMedia(file, 'news');
    if (url) {
      const tag = `![${caption}](${url})`;
      onInsert(tag);
      setCaption('');
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <ImagePlus className="h-4 w-4 mr-2" />
          Sett inn bilde
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <Label className="text-sm font-medium">Sett inn bilde i artikkelen</Label>
          <div className="space-y-2">
            <Label htmlFor="img-caption" className="text-xs text-muted-foreground">
              Bildetekst (valgfritt)
            </Label>
            <Input
              id="img-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Beskriv bildet..."
              className="text-sm"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Laster opp...
              </>
            ) : (
              <>
                <ImagePlus className="h-4 w-4 mr-2" />
                Velg bilde
              </>
            )}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = '';
            }}
          />
          <p className="text-xs text-muted-foreground">
            Bildet settes inn der markøren står i teksten.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
