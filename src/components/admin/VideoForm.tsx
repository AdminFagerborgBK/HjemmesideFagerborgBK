import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ImageUpload } from './ImageUpload';
import { SiteVideo, useCreateSiteVideo, useUpdateSiteVideo } from '@/hooks/useSiteVideos';
import { useFacebookShare } from '@/hooks/useFacebookShare';
import { useMediaUpload } from '@/hooks/useMediaUpload';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useTikTokHealth, useTikTokPublish } from '@/hooks/useTikTokAuth';
import { useMatches } from '@/hooks/useMatches';
import { formatOsloDateLong } from '@/lib/osloTime';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Facebook, Upload, Link as LinkIcon, CalendarClock, Clock } from 'lucide-react';
import { convertMovToMp4, isMovFile } from '@/lib/convertMovToMp4';
import { captureVideoFrame } from '@/lib/captureVideoFrame';

interface VideoFormProps {
  video?: SiteVideo | null;
  mode: 'create' | 'edit';
}

export const VideoForm = ({ video, mode }: VideoFormProps) => {
  const navigate = useNavigate();
  const createVideo = useCreateSiteVideo();
  const updateVideo = useUpdateSiteVideo();
  const { shareToFacebook, isSharing } = useFacebookShare();
  const { uploadMedia, uploading } = useMediaUpload();
  const { data: settings } = useSiteSettings();
  const { data: tikTokHealth } = useTikTokHealth();
  const tikTokPublish = useTikTokPublish();
  const { data: allMatches } = useMatches();
  const [shareOnFacebook, setShareOnFacebook] = useState(false);
  const [shareOnTikTok, setShareOnTikTok] = useState(false);
  const [videoInputMode, setVideoInputMode] = useState<'url' | 'upload'>('url');
  const [converting, setConverting] = useState(false);
  const [convertProgress, setConvertProgress] = useState(0);
  const [addPromoVideo, setAddPromoVideo] = useState(false);
  const [useSchedule, setUseSchedule] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string>('');
  const [selectedMatchId, setSelectedMatchId] = useState<string>('');

  const promoVideoUrl = typeof settings?.promo_video_url === 'string' ? settings.promo_video_url : '';
  const now = Date.now();
  const recentMatches = (allMatches || [])
    .sort((a, b) => {
      const aTime = new Date(a.match_date).getTime();
      const bTime = new Date(b.match_date).getTime();
      const aIsPast = aTime <= now;
      const bIsPast = bTime <= now;
      // Past matches first (sorted newest first), then future matches (sorted earliest first)
      if (aIsPast && !bIsPast) return -1;
      if (!aIsPast && bIsPast) return 1;
      if (aIsPast && bIsPast) return bTime - aTime; // newest past first
      return aTime - bTime; // earliest future first
    });

  const handleMatchSelect = (matchId: string) => {
    setSelectedMatchId(matchId);
    if (matchId === 'none') {
      setFormData(prev => ({ ...prev, match_id: null }));
      return;
    }
    const match = recentMatches.find(m => m.id === matchId);
    if (!match) return;
    
    // Auto-set category to 'highlights' if still on default 'general'
    const categoryValue = (formData.category === 'general' || !formData.category) ? 'highlights' : formData.category;
    const homeTeam = match.is_home ? 'Fagerborg' : match.opponent;
    const awayTeam = match.is_home ? match.opponent : 'Fagerborg';
    const dateFormatted = formatOsloDateLong(match.match_date);
    const score = match.status === 'finished' && match.home_score !== null
      ? `${match.home_score} - ${match.away_score}`
      : '';

    let title: string;
    if (categoryValue === 'match_day') {
      title = `${match.opponent} | Match Day`;
    } else if (categoryValue === 'highlights') {
      title = `${homeTeam} vs ${awayTeam} | Høydepunkter`;
    } else if (categoryValue === 'full_match') {
      title = `${homeTeam} vs ${awayTeam} | Full kamp`;
    } else {
      title = `${homeTeam} vs ${awayTeam}`;
    }

    const descriptionParts = categoryValue === 'full_match'
      ? [
          `📅 ${dateFormatted}`,
          `📍 ${match.venue}`,
          `🏆 ${match.competition}`,
          score ? `⚽ Resultat: ${score}` : '',
          '',
          '#fagerborgbk #fotball #oslo',
        ].filter(Boolean).join('\n')
      : '';

    // Generate default password from match date: "madronoballDDMM"
    const matchDate = new Date(match.match_date);
    const dd = String(matchDate.getDate()).padStart(2, '0');
    const mm = String(matchDate.getMonth() + 1).padStart(2, '0');
    const defaultPassword = `madronoball${dd}${mm}`;

    setFormData(prev => ({
      ...prev,
      title,
      description: descriptionParts,
      match_id: matchId,
      category: categoryValue,
      protected_password: prev.is_protected ? defaultPassword : prev.protected_password,
    }));
  };


  const [formData, setFormData] = useState({
    title: '',
    description: '',
    video_url: '',
    thumbnail_url: null as string | null,
    status: 'draft' as 'draft' | 'published',
    published_at: null as string | null,
    is_protected: false,
    protected_password: null as string | null,
    category: 'general' as string | null,
    match_id: null as string | null,
    sort_order: 0,
  });

  useEffect(() => {
    if (video) {
      // Derive default password from linked match date
      let defaultPw: string | null = null;
      if (video.is_protected && video.match_id && allMatches) {
        const match = allMatches.find(m => m.id === video.match_id);
        if (match) {
          const d = new Date(match.match_date);
          defaultPw = `madronoball${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}`;
        }
      }
      setFormData({
        title: video.title,
        description: (video.category === 'full_match' ? video.description : '') || '',
        video_url: video.video_url || '',
        thumbnail_url: video.thumbnail_url,
        status: video.status,
        published_at: video.published_at,
        is_protected: video.is_protected ?? false,
        protected_password: defaultPw,
        category: video.category ?? 'general',
        match_id: video.match_id ?? null,
        sort_order: (video as any).sort_order ?? 0,
      });
      if (video.match_id) setSelectedMatchId(video.match_id);
      // Check if video has a future published_at (scheduled)
      if (video.published_at && new Date(video.published_at) > new Date()) {
        setUseSchedule(true);
        const d = new Date(video.published_at);
        const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        setScheduledAt(local);
      }
    }
  }, [video, allMatches]);

  const MAX_FILE_SIZE_MB = 500;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      alert(`Filen er for stor (${(file.size / 1024 / 1024).toFixed(0)} MB). Maks ${MAX_FILE_SIZE_MB} MB. For større filer, bruk ekstern URL (YouTube/Hudl).`);
      e.target.value = '';
      return;
    }

    if (isMovFile(file)) {
      try {
        setConverting(true);
        setConvertProgress(0);
        file = await convertMovToMp4(file, (r) => setConvertProgress(r));
      } catch (err) {
        console.error('MOV→MP4 conversion failed:', err);
        alert('Kunne ikke konvertere .mov-filen automatisk. Prøv å eksportere den som .mp4 først.');
        e.target.value = '';
        setConverting(false);
        return;
      } finally {
        setConverting(false);
      }
    }

    const url = await uploadMedia(file, 'videos');
    if (url) {
      setFormData(prev => ({ ...prev, video_url: url }));
      // Auto-generate a natural cover image from a frame inside the video
      if (!formData.thumbnail_url) {
        try {
          const frame = await captureVideoFrame(file);
          if (frame) {
            const thumbUrl = await uploadMedia(frame, 'video-thumbnails');
            if (thumbUrl) setFormData(prev => ({ ...prev, thumbnail_url: prev.thumbnail_url || thumbUrl }));
          }
        } catch (err) {
          console.error('Kunne ikke lage miniatyrbilde fra video:', err);
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let passwordToSave = formData.protected_password;
    let skipPasswordUpdate = false;
    
    if (formData.is_protected && formData.protected_password) {
      if (!formData.protected_password.startsWith('$2')) {
        try {
          const { data, error } = await supabase.functions.invoke('hash-video-password', {
            body: { password: formData.protected_password },
          });
          if (error) throw error;
          passwordToSave = data.hash;
        } catch (err) {
          console.error('Failed to hash password:', err);
          alert('Kunne ikke hashe passord. Prøv igjen.');
          return;
        }
      }
    } else if (mode === 'edit' && formData.is_protected && !formData.protected_password) {
      // No password entered on edit — keep existing hash in DB
      skipPasswordUpdate = true;
    }
    
    const isScheduled = Boolean(useSchedule && scheduledAt && new Date(scheduledAt) > new Date());
    
    const data = {
      ...formData,
      ...(skipPasswordUpdate ? {} : { protected_password: passwordToSave }),
      scheduled_facebook: Boolean(isScheduled && shareOnFacebook),
      scheduled_tiktok: Boolean(isScheduled && shareOnTikTok),
      published_at: useSchedule && scheduledAt && formData.status === 'published'
        ? new Date(scheduledAt).toISOString()
        : formData.status === 'published' && !formData.published_at 
          ? new Date().toISOString() 
          : formData.published_at,
    };

    if (mode === 'create') {
      await createVideo.mutateAsync(data);
    } else if (video) {
      await updateVideo.mutateAsync({ id: video.id, ...data });
    }

    // Share immediately only if NOT scheduled
    if (shareOnFacebook && formData.status === 'published' && !isScheduled) {
      const hashtags = '#fagerborgbk #fotball #oslo #høydepunkter';
      const fbMessage = `🎬 ${formData.title}\n\n${formData.description || 'Ny video fra Fagerborg BK!'}\n\n${formData.category === 'highlights' ? hashtags : '#fagerborgbk #fotball'}`;
      const cleanVideoUrl = formData.video_url.split('?')[0];
      const isDirectVideoUrl = cleanVideoUrl.match(/\.(mp4|mov|avi|wmv|webm)$/i);
      
      if (isDirectVideoUrl) {
        await shareToFacebook({
          message: fbMessage,
          video_url: cleanVideoUrl,
        });
      } else {
        await shareToFacebook({
          message: fbMessage + '\n\n▶️ Se videoen her:',
          link: formData.video_url,
          image_url: formData.thumbnail_url || undefined,
        });
      }
    }

    if (shareOnTikTok && formData.status === 'published' && formData.category === 'highlights' && !isScheduled) {
      await tikTokPublish.mutateAsync({
        video_url: formData.video_url,
        title: formData.title,
        description: formData.description,
      });
    }
    
    navigate('/admin/videos');
  };

  const isLoading = createVideo.isPending || updateVideo.isPending || isSharing;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          {/* Match Selection */}
          <div>
            <Label>Koble til kamp (valgfritt)</Label>
            <Select value={selectedMatchId} onValueChange={handleMatchSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Velg kamp..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ingen kamp</SelectItem>
                {recentMatches.map((match) => {
                  const homeTeam = match.is_home ? 'Fagerborg' : match.opponent;
                  const awayTeam = match.is_home ? match.opponent : 'Fagerborg';
                  const score = match.status === 'finished' && match.home_score !== null
                    ? ` (${match.home_score}-${match.away_score})`
                    : '';
                  const date = new Date(match.match_date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
                  return (
                    <SelectItem key={match.id} value={match.id}>
                      {date} — {homeTeam} vs {awayTeam}{score} ({match.team})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {mode === 'create' ? 'Velg en kamp for å autogenerere tittel og beskrivelse' : 'Koble videoen til en kamp'}
            </p>
          </div>

          <div>
            <Label htmlFor="category">Kategori</Label>
            <Select
              value={formData.category || 'general'}
              onValueChange={(value) => {
                setFormData(prev => ({ ...prev, category: value }));
                // Re-fill if a match is selected
                if (selectedMatchId && selectedMatchId !== 'none') {
                  const match = recentMatches.find(m => m.id === selectedMatchId);
                  if (match) {
                    const homeTeam = match.is_home ? 'Fagerborg' : match.opponent;
                    const awayTeam = match.is_home ? match.opponent : 'Fagerborg';
                    let title: string;
                    if (value === 'match_day') {
                      title = `${match.opponent} | Match Day`;
                    } else if (value === 'highlights') {
                      title = `${homeTeam} vs ${awayTeam} | Høydepunkter`;
                    } else if (value === 'full_match') {
                      title = `${homeTeam} vs ${awayTeam} | Full kamp`;
                    } else {
                      title = `${homeTeam} vs ${awayTeam}`;
                    }
                    const dateFormatted = formatOsloDateLong(match.match_date);
                    const score = match.status === 'finished' && match.home_score !== null
                      ? `${match.home_score} - ${match.away_score}` : '';
                    const descriptionParts = value === 'full_match'
                      ? [
                          `📅 ${dateFormatted}`, `📍 ${match.venue}`, `🏆 ${match.competition}`,
                          score ? `⚽ Resultat: ${score}` : '', '', '#fagerborgbk #fotball #oslo',
                        ].filter(Boolean).join('\n')
                      : '';
                    setFormData(prev => ({ ...prev, category: value, title, description: descriptionParts }));
                  }
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">Generelt</SelectItem>
                <SelectItem value="highlights">Høydepunkter</SelectItem>
                <SelectItem value="match_day">Match Day</SelectItem>
                <SelectItem value="full_match">Full kamp</SelectItem>
                <SelectItem value="inside">Inside</SelectItem>
                <SelectItem value="podcast">Podcast</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select 
              value={formData.status} 
              onValueChange={(value: 'draft' | 'published') => {
                setFormData(prev => ({ ...prev, status: value }));
                if (value === 'draft') setUseSchedule(false);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Utkast</SelectItem>
                <SelectItem value="published">Publisert</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.status === 'published' && (
            <div className="space-y-3 p-3 rounded-md border bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="use-schedule-video" className="text-sm">Planlegg publisering</Label>
                </div>
                <Switch
                  id="use-schedule-video"
                  checked={useSchedule}
                  onCheckedChange={setUseSchedule}
                />
              </div>
              {useSchedule && (
                <div className="space-y-1.5">
                  <Input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                  />
                  {scheduledAt && new Date(scheduledAt) > new Date() && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Publiseres {new Date(scheduledAt).toLocaleString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="title">Tittel *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              required
            />
          </div>

          <div>
            <Label>Video *</Label>
            <Tabs value={videoInputMode} onValueChange={(v) => setVideoInputMode(v as 'url' | 'upload')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="url" className="gap-1.5">
                  <LinkIcon className="h-3.5 w-3.5" />
                  URL
                </TabsTrigger>
                <TabsTrigger value="upload" className="gap-1.5">
                  <Upload className="h-3.5 w-3.5" />
                  Last opp fil
                </TabsTrigger>
              </TabsList>
              <TabsContent value="url" className="mt-2">
                <Input
                  type="url"
                  value={formData.video_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, video_url: e.target.value }))}
                  placeholder="https://youtube.com/watch?v=... eller https://vimeo.com/..."
                />
              </TabsContent>
              <TabsContent value="upload" className="mt-2">
                <div className="space-y-2">
                  <Input
                    type="file"
                    accept="video/*"
                    onChange={handleFileUpload}
                    disabled={uploading || converting}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maks {MAX_FILE_SIZE_MB} MB. .mov-filer konverteres automatisk til Chrome-kompatibel .mp4. For større filer (f.eks. full kamp), bruk ekstern URL.
                  </p>
                  {converting && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Konverterer .mov → .mp4... {Math.round(convertProgress * 100)}%
                    </div>
                  )}
                  {uploading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Laster opp video...
                    </div>
                  )}
                  {formData.video_url && videoInputMode === 'upload' && (
                    <p className="text-xs text-green-600">✓ Video lastet opp</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
            {formData.video_url && (
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {formData.video_url}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="description">Beskrivelse</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={4}
            />
          </div>

          <div>
            <Label htmlFor="sort_order">Sorteringsrekkefølge</Label>
            <Input
              id="sort_order"
              type="number"
              value={formData.sort_order}
              onChange={(e) => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Høyere tall = vises først på forsiden. Standard er 0.
            </p>
          </div>

          {promoVideoUrl && formData.category === 'highlights' && (
            <div className="flex items-center justify-between pt-2 border-t">
              <div>
                <Label htmlFor="add-promo">Legg til promovideo</Label>
                <p className="text-xs text-muted-foreground">
                  Vis sponsor-promovideo før hovedvideoen
                </p>
              </div>
              <Switch
                id="add-promo"
                checked={addPromoVideo}
                onCheckedChange={setAddPromoVideo}
              />
            </div>
          )}

          {formData.status === 'published' && (
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-2">
                <Facebook className="h-4 w-4 text-[#1877F2]" />
                <Label htmlFor="share-facebook-video" className="text-sm">Del på Facebook</Label>
              </div>
              <Switch
                id="share-facebook-video"
                checked={shareOnFacebook}
                onCheckedChange={setShareOnFacebook}
              />
            </div>
          )}

          {formData.status === 'published' && formData.category === 'highlights' && tikTokHealth?.status === 'valid' && (
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.88a8.28 8.28 0 004.76 1.49V6.92a4.84 4.84 0 01-1-.23z" />
                </svg>
                <Label htmlFor="share-tiktok-video" className="text-sm">Del på TikTok</Label>
              </div>
              <Switch
                id="share-tiktok-video"
                checked={shareOnTikTok}
                onCheckedChange={setShareOnTikTok}
              />
            </div>
          )}

          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="is_protected">Passordbeskyttet</Label>
                <p className="text-sm text-muted-foreground">
                  Krev passord for å se videoen (f.eks. treningsvideoer)
                </p>
              </div>
              <Switch
                id="is_protected"
                checked={formData.is_protected}
                onCheckedChange={(checked) => {
                  let defaultPw: string | null = null;
                  if (checked && selectedMatchId && selectedMatchId !== 'none') {
                    const match = recentMatches.find(m => m.id === selectedMatchId);
                    if (match) {
                      const d = new Date(match.match_date);
                      defaultPw = `madronoball${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}`;
                    }
                  }
                  setFormData(prev => ({ 
                    ...prev, 
                    is_protected: checked,
                    protected_password: checked ? (prev.protected_password || defaultPw) : null 
                  }));
                }}
              />
            </div>

            {formData.is_protected && (
              <div>
                <Label htmlFor="protected_password">Felles passord</Label>
                <Input
                  id="protected_password"
                  type="text"
                  value={formData.protected_password || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, protected_password: e.target.value || null }))}
                  placeholder="Skriv inn passord for denne videoen"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Del dette passordet med de som skal ha tilgang
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Miniatyrbilde</Label>
            <ImageUpload
              value={formData.thumbnail_url}
              onChange={(url) => setFormData(prev => ({ ...prev, thumbnail_url: url }))}
              folder="videos"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <Button type="submit" disabled={isLoading || uploading || converting || !formData.video_url}>
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {mode === 'create' ? 'Opprett video' : 'Lagre endringer'}
        </Button>
        <Button type="button" variant="outline" onClick={() => navigate('/admin/videos')}>
          Avbryt
        </Button>
      </div>
    </form>
  );
};
