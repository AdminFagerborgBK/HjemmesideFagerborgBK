import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, Image, Loader2, Share2, Instagram } from 'lucide-react';
import html2canvas from 'html2canvas';
import { formatOsloTime } from '@/lib/osloTime';
import fagerborgLogo from '@/assets/fagerborg-logo.png';
import { toast } from 'sonner';

interface MatchGraphicGeneratorProps {
  match: {
    id: string;
    opponent: string;
    match_date: string;
    venue: string;
    is_home: boolean;
    competition: string;
    opponent_logo_url?: string | null;
    home_score?: number | null;
    away_score?: number | null;
    status: string;
  };
  /** Resolved opponent logo URL (e.g. from standings lookup) */
  resolvedOpponentLogo?: string | null;
}

const norwegianDays = ['SØN', 'MAN', 'TIR', 'ONS', 'TOR', 'FRE', 'LØR'];
const norwegianMonths = ['JAN', 'FEB', 'MAR', 'APR', 'MAI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DES'];

export function MatchGraphicGenerator({ match, resolvedOpponentLogo }: MatchGraphicGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [storyMode, setStoryMode] = useState(false);
  const graphicRef = useRef<HTMLDivElement>(null);

  const matchDate = new Date(match.match_date);
  const dayName = norwegianDays[matchDate.getDay()];
  const day = matchDate.getDate();
  const month = norwegianMonths[matchDate.getMonth()];
  const year = matchDate.getFullYear();
  const time = formatOsloTime(match.match_date);

  const isFinished = match.status === 'finished';
  const homeTeam = match.is_home ? 'Fagerborg' : match.opponent;
  const awayTeam = match.is_home ? match.opponent : 'Fagerborg';
  // Database stores actual home/away scores (not Fagerborg perspective)
  // home_score = what the actual home team scored
  // away_score = what the actual away team scored
  // So we use them directly - no swapping needed
  const homeScore = match.home_score;
  const awayScore = match.away_score;
  const opponentLogo = match.opponent_logo_url || resolvedOpponentLogo || null;

  const getRenderableImageUrl = (src?: string | null) => {
    if (!src) return null;
    if (src.startsWith('data:') || src.includes('/functions/v1/image-proxy?url=')) {
      return src;
    }

    const isExternal =
      typeof window !== 'undefined' &&
      src.startsWith('http') &&
      !src.includes(window.location.hostname);

    return isExternal
      ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-proxy?url=${encodeURIComponent(src)}`
      : src;
  };

  const homeLogo = getRenderableImageUrl(match.is_home ? fagerborgLogo : opponentLogo);
  const awayLogo = getRenderableImageUrl(match.is_home ? opponentLogo : fagerborgLogo);

  const fileName = `kamp-${match.opponent.toLowerCase().replace(/\s+/g, '-')}-${matchDate.toISOString().split('T')[0]}.png`;

  const generateImage = async (): Promise<Blob | null> => {
    if (!graphicRef.current) return null;

    try {
      await document.fonts?.ready;
    } catch {
      /* ignore */
    }

    // Convert all external images to data-URLs so html2canvas can render them
    const imgs = Array.from(graphicRef.current.querySelectorAll('img'));
    const originals: { img: HTMLImageElement; src: string }[] = [];
    await Promise.all(
      imgs.map(async (img) => {
        if (!img.src || img.src.startsWith('data:')) return;
        try {
          const isAlreadyProxied = img.src.includes('/functions/v1/image-proxy?url=');
          const isExternal = img.src.startsWith('http') && !img.src.includes(window.location.hostname);
          const fetchUrl = isExternal && !isAlreadyProxied
            ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-proxy?url=${encodeURIComponent(img.src)}`
            : img.src;
          const resp = await fetch(fetchUrl);
          const blob = await resp.blob();
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          originals.push({ img, src: img.src });
          img.src = dataUrl;
        } catch {
          // If fetch fails, keep original src
        }
      })
    );

    // Wait for replaced images to settle
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

    const canvas = await html2canvas(graphicRef.current, {
      scale: 4,
      backgroundColor: null,
      useCORS: true,
      allowTaint: true,
      width: graphicRef.current.offsetWidth,
      height: graphicRef.current.offsetHeight,
    });

    // Restore original srcs
    originals.forEach(({ img, src }) => { img.src = src; });

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png', 1.0);
    });
  };

  // Check if Web Share API with files is supported
  const canShare = typeof navigator !== 'undefined' && 
    navigator.share && 
    navigator.canShare;

  const handleInstagramStory = async () => {
    setIsGenerating(true);
    setStoryMode(true);
    // Wait for re-render with story dimensions
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    try {
      const blob = await generateImage();
      if (!blob) throw new Error('Kunne ikke generere bilde');

      const file = new File([blob], fileName.replace('.png', '-story.png'), { type: 'image/png' });

      if (canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Kamp: Fagerborg vs ${match.opponent}`,
        });
        toast.success('Delt!');
      } else {
        // Fallback: show image for manual save
        const url = URL.createObjectURL(blob);
        setGeneratedImageUrl(url);
        toast.info('Last ned bildet og del det på Instagram Stories');
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Error sharing story:', error);
        toast.error('Kunne ikke dele bildet');
      }
    } finally {
      setIsGenerating(false);
      setStoryMode(false);
    }
  };

  const handleShare = async () => {
    setIsGenerating(true);
    try {
      const blob = await generateImage();
      if (!blob) throw new Error('Kunne ikke generere bilde');

      const file = new File([blob], fileName, { type: 'image/png' });
      
      if (canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Kamp: Fagerborg vs ${match.opponent}`,
        });
        toast.success('Delt!');
      } else {
        const url = URL.createObjectURL(blob);
        setGeneratedImageUrl(url);
        toast.info('Hold inne bildet for å lagre det');
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Error sharing:', error);
        toast.error('Kunne ikke dele bildet');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      const blob = await generateImage();
      if (!blob) throw new Error('Kunne ikke generere bilde');

      // For mobile browsers, try share first if available
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      if (isMobile && canShare) {
        const file = new File([blob], fileName, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `Kamp: Fagerborg vs ${match.opponent}`,
          });
          toast.success('Delt!');
          return;
        }
      }

      // Desktop or fallback: traditional download
      const url = URL.createObjectURL(blob);

      // Show the exact generated PNG in the dialog as well (same blob as download)
      setGeneratedImageUrl(url);

      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Bilde lastet ned');
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Error downloading:', error);
        // Show image for manual save as fallback
        try {
          const blob = await generateImage();
          if (blob) {
            const url = URL.createObjectURL(blob);
            setGeneratedImageUrl(url);
            toast.info('Hold inne bildet for å lagre det');
          }
        } catch {
          toast.error('Kunne ikke laste ned bildet');
        }
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Clean up generated image URL when closing
      if (generatedImageUrl) {
        URL.revokeObjectURL(generatedImageUrl);
        setGeneratedImageUrl(null);
      }
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        title="Last ned kampgrafikk"
      >
        <Image className="h-4 w-4" />
      </Button>

      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kampgrafikk for sosiale medier</DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-col items-center gap-4">
            {/* Show generated image for manual save on mobile */}
            {generatedImageUrl ? (
              <div className="flex flex-col items-center gap-4 w-full">
                <p className="text-sm text-muted-foreground text-center">
                  Hold inne bildet nedenfor for å lagre det til kamerarullen
                </p>
                <img 
                  src={generatedImageUrl} 
                  alt="Kampgrafikk" 
                  className="max-w-full rounded-lg shadow-lg"
                  style={{ maxHeight: '60vh' }}
                />
                <Button 
                  variant="outline" 
                  onClick={() => setGeneratedImageUrl(null)}
                  className="w-full max-w-xs"
                >
                  Generer på nytt
                </Button>
              </div>
            ) : (
              <>
                {/* The graphic to be downloaded */}
                <div className="overflow-x-auto w-full flex justify-center">
                  <div
                    ref={graphicRef}
                    className="relative overflow-hidden flex-shrink-0"
                    style={{
                      width: storyMode ? '540px' : '600px',
                      height: storyMode ? '960px' : '600px',
                      background: 'linear-gradient(135deg, #4a5568 0%, #2d3748 50%, #1a202c 100%)',
                    }}
                  >
                    {/* Inner white card */}
                    <div className="absolute inset-6 bg-white rounded-2xl shadow-2xl flex flex-col items-center justify-center gap-8 py-8 px-6">
                      {/* Date header */}
                      <div className="text-center">
                        <p className="text-[#2d3748] font-bold text-xl tracking-wide">
                          {dayName}. {day}. {month}. {year}
                        </p>
                        <p className="text-[#718096] text-sm tracking-widest mt-1 uppercase">
                          {match.competition}
                        </p>
                      </div>

                      {/* Teams section */}
                      <div className={`flex items-start justify-center gap-8 w-full ${storyMode ? 'flex-col items-center gap-6' : ''}`}>
                        {/* Home team */}
                        <div className="flex flex-col items-center gap-3 flex-1">
                          <div className={`flex items-center justify-center ${storyMode ? 'w-32 h-32' : 'w-24 h-24'}`}>
                            {homeLogo ? (
                              <img 
                                src={homeLogo} 
                                alt={homeTeam}
                                className="max-w-full max-h-full object-contain"
                                crossOrigin="anonymous"
                              />
                            ) : (
                              <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center text-gray-400 text-xs">
                                Logo
                              </div>
                            )}
                          </div>
                          <p className="text-[#2d3748] font-semibold text-center text-lg">
                            {homeTeam}
                          </p>
                        </div>

                        {/* Time or Score */}
                        <div className={`flex items-center justify-center ${storyMode ? '' : 'h-24'}`}>
                          <svg width="120" height="56" viewBox="0 0 120 56" xmlns="http://www.w3.org/2000/svg">
                            <rect width="120" height="56" rx="8" fill="#2d3748" />
                            <text
                              x="60"
                              y="50%"
                              dominantBaseline="central"
                              textAnchor="middle"
                              fill="white"
                              fontFamily="Arial, Helvetica, sans-serif"
                              fontSize="30"
                              fontWeight="700"
                            >
                              {isFinished && homeScore !== null && awayScore !== null
                                ? `${homeScore}-${awayScore}`
                                : time}
                            </text>
                          </svg>
                        </div>

                        {/* Away team */}
                        <div className="flex flex-col items-center gap-3 flex-1">
                          <div className={`flex items-center justify-center ${storyMode ? 'w-32 h-32' : 'w-24 h-24'}`}>
                            {awayLogo ? (
                              <img 
                                src={awayLogo} 
                                alt={awayTeam}
                                className="max-w-full max-h-full object-contain"
                                crossOrigin="anonymous"
                              />
                            ) : (
                              <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center text-gray-400 text-xs">
                                Logo
                              </div>
                            )}
                          </div>
                          <p className="text-[#2d3748] font-semibold text-center text-lg">
                            {awayTeam}
                          </p>
                        </div>
                      </div>

                      {/* Venue */}
                      <div className="text-center">
                        <p className="text-[#718096] text-sm tracking-widest uppercase">
                          {match.venue}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row gap-2 w-full max-w-md">
                  <Button 
                    onClick={handleInstagramStory} 
                    disabled={isGenerating} 
                    variant="outline"
                    className="flex-1"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Genererer...
                      </>
                    ) : (
                      <>
                        <Instagram className="h-4 w-4 mr-2" />
                        Instagram Story
                      </>
                    )}
                  </Button>
                  {canShare && (
                    <Button 
                      onClick={handleShare} 
                      disabled={isGenerating} 
                      variant="outline"
                      className="flex-1"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Genererer...
                        </>
                      ) : (
                        <>
                          <Share2 className="h-4 w-4 mr-2" />
                          Del bilde
                        </>
                      )}
                    </Button>
                  )}
                  <Button 
                    onClick={handleDownload} 
                    disabled={isGenerating} 
                    className="flex-1"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Genererer...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Last ned
                      </>
                    )}
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
