import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useTikTokHealth, useTikTokPublish } from '@/hooks/useTikTokAuth';
import { Loader2, Download, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.88a8.28 8.28 0 004.76 1.49V6.92a4.84 4.84 0 01-1-.23z" />
    </svg>
  );
}

interface TikTokPublishButtonProps {
  videoUrl: string;
  title: string;
  description?: string;
  videoId?: string;
}

export function TikTokPublishButton({ videoUrl, title, description, videoId }: TikTokPublishButtonProps) {
  const { data: health } = useTikTokHealth();
  const publish = useTikTokPublish();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const caption = `${title}\n\n${description || 'Ny video fra Fagerborg BK!'}\n\n#fagerborgbk #fotball #oslo #norskfotball #fagerborg`;
  const isConnected = health?.status === 'valid';

  const handlePublish = async () => {
    await publish.mutateAsync({ video_url: videoUrl, title, description, video_id: videoId });
    setOpen(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(caption);
    setCopied(true);
    toast({ title: 'Tekst kopiert!' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <TikTokIcon className="h-3.5 w-3.5" />
          TikTok
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TikTokIcon className="h-5 w-5" />
            Publiser på TikTok
          </DialogTitle>
          <DialogDescription>
            {isConnected
              ? 'Publiser videoen direkte til TikTok-kontoen.'
              : 'TikTok er ikke koblet til. Bruk manuell publisering nedenfor.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Caption preview */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Tekst / Caption:</p>
            <div className="bg-muted p-3 rounded-lg text-sm whitespace-pre-wrap">{caption}</div>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
              {copied ? 'Kopiert!' : 'Kopier tekst'}
            </Button>
          </div>

          {/* Manual fallback: download */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Last ned video:</p>
            <Button variant="outline" size="sm" asChild>
              <a href={videoUrl} download target="_blank" rel="noopener noreferrer">
                <Download className="h-3.5 w-3.5 mr-1" />
                Last ned MP4
              </a>
            </Button>
            <p className="text-xs text-muted-foreground">
              Last ned videoen og last den opp manuelt i TikTok-appen. Anbefalt format: 9:16 (1080×1920).
            </p>
          </div>
        </div>

        <DialogFooter>
          {isConnected && (
            <Button onClick={handlePublish} disabled={publish.isPending}>
              {publish.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Publiser på TikTok
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
