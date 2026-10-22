import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useSiteSettings, useUpdateSiteSetting } from '@/hooks/useSiteSettings';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Settings, AlertTriangle, Video, Upload } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FacebookTokenStatus } from '@/components/admin/FacebookTokenStatus';
import { TikTokTokenStatus } from '@/components/admin/TikTokTokenStatus';
import { useMediaUpload } from '@/hooks/useMediaUpload';
import SportsSeasonSettings from '@/components/admin/SportsSeasonSettings';

const AdminSettings = () => {
  const { data: settings, isLoading } = useSiteSettings();
  const updateSetting = useUpdateSiteSetting();
  const { uploadMedia, uploading } = useMediaUpload();
  const [promoUploading, setPromoUploading] = useState(false);

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  const sponsorsEnabled = settings?.sponsors_enabled === true;
  const podcastEnabled = settings?.show_podcast === true;
  const portalsEnabled = settings?.show_portals !== false;
  const promoVideoUrl = typeof settings?.promo_video_url === 'string' ? settings.promo_video_url : '';

  const handleToggle = async (key: string, checked: boolean) => {
    await updateSetting.mutateAsync({ key, value: checked });
  };

  const handleUrlChange = async (key: string, value: string) => {
    await updateSetting.mutateAsync({ key, value });
  };

  const handlePromoVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPromoUploading(true);
    const url = await uploadMedia(file, 'promo');
    if (url) {
      await updateSetting.mutateAsync({ key: 'promo_video_url', value: url });
    }
    setPromoUploading(false);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Innstillinger</h1>
          <p className="text-muted-foreground">Administrer nettsidens innstillinger</p>
        </div>

        <SportsSeasonSettings />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Funksjoner
            </CardTitle>
            <CardDescription>
              Aktiver eller deaktiver funksjoner på nettsiden
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="sponsors">Sponsorer</Label>
                <p className="text-sm text-muted-foreground">
                  Vis sponsorseksjon og sponsoradministrasjon
                </p>
              </div>
              <Switch
                id="sponsors"
                checked={sponsorsEnabled}
                onCheckedChange={(c) => handleToggle('sponsors_enabled', c)}
                disabled={updateSetting.isPending}
              />
            </div>

            {!sponsorsEnabled && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Sponsorfunksjoner er midlertidig deaktivert. Sponsorseksjonen vises ikke på nettsiden og sponsoradministrasjon er ikke tilgjengelig.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="portals">Klubbportaler</Label>
                <p className="text-sm text-muted-foreground">
                  Vis lenker til Spiller- og Trenerportalen i bunnteksten
                </p>
              </div>
              <Switch
                id="portals"
                checked={portalsEnabled}
                onCheckedChange={(c) => handleToggle('show_portals', c)}
                disabled={updateSetting.isPending}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="podcast">Podcast</Label>
                <p className="text-sm text-muted-foreground">
                  Vis Podcast i navigasjonen og videomenyen
                </p>
              </div>
              <Switch
                id="podcast"
                checked={podcastEnabled}
                onCheckedChange={(c) => handleToggle('show_podcast', c)}
                disabled={updateSetting.isPending}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="livestream">Direktesendinger</Label>
                <p className="text-sm text-muted-foreground">
                  Vis «Se live»-knapp på kampkort og aktiver direktesendingssiden
                </p>
              </div>
              <Switch
                id="livestream"
                checked={settings?.show_livestream === true}
                onCheckedChange={(c) => handleToggle('show_livestream', c)}
                disabled={updateSetting.isPending}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="livestream-otp">Medlemsverifisering for livestream</Label>
                <p className="text-sm text-muted-foreground">
                  Krev e-postverifisering (OTP) for å se direktesendinger. Deaktiver for å la alle se.
                </p>
              </div>
              <Switch
                id="livestream-otp"
                checked={settings?.livestream_require_otp !== false}
                onCheckedChange={(c) => handleToggle('livestream_require_otp', c)}
                disabled={updateSetting.isPending}
              />
            </div>

          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Promovideo (Sponsorklipp)
            </CardTitle>
            <CardDescription>
              Last opp en kort sponsorvideo (f.eks. 3 sek «Sponsored by...») som kan vises før høydepunktvideoer
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {promoVideoUrl && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Nåværende promovideo:</Label>
                <video 
                  src={promoVideoUrl} 
                  controls 
                  className="w-full max-w-sm rounded-lg border"
                  style={{ maxHeight: 200 }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUrlChange('promo_video_url', '')}
                  disabled={updateSetting.isPending}
                >
                  Fjern promovideo
                </Button>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="promo-upload">{promoVideoUrl ? 'Bytt promovideo' : 'Last opp promovideo'}</Label>
              <Input
                id="promo-upload"
                type="file"
                accept="video/*"
                onChange={handlePromoVideoUpload}
                disabled={promoUploading || uploading}
              />
              {promoUploading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Laster opp...
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Anbefalt: Kort video (2–5 sek) med sponsorlogo/tekst. Vises automatisk som pre-roll før høydepunktvideoer.
              </p>
            </div>
          </CardContent>
        </Card>

        <FacebookTokenStatus />
        <TikTokTokenStatus />

      </div>
    </AdminLayout>
  );
};

export default AdminSettings;
