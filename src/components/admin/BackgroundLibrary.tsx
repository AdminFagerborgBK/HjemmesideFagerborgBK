import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, Star, Trash2, Check } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import {
  useGraphicBackgrounds,
  useCreateGraphicBackground,
  useSetDefaultBackground,
  useDeleteGraphicBackground,
} from '@/hooks/useGraphicBackgrounds';
import { useMediaUpload } from '@/hooks/useMediaUpload';

export function BackgroundLibrary() {
  const { data: backgrounds, isLoading } = useGraphicBackgrounds();
  const createMutation = useCreateGraphicBackground();
  const setDefaultMutation = useSetDefaultBackground();
  const deleteMutation = useDeleteGraphicBackground();
  const { uploadMedia, uploading } = useMediaUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadMedia(file, 'graphic-backgrounds');
    if (!url) return;
    const bgName = name.trim() || file.name.replace(/\.[^.]+$/, '');
    const isFirst = !backgrounds || backgrounds.length === 0;
    await createMutation.mutateAsync({ name: bgName, image_url: url, is_default: isFirst });
    setName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bakgrunnsbilder</CardTitle>
        <CardDescription>Last opp og velg bakgrunnsbilde for tabellgrafikk</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload section */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <Label htmlFor="bg-name" className="sr-only">Navn</Label>
            <Input
              id="bg-name"
              placeholder="Navn (valgfritt)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || createMutation.isPending}
          >
            {uploading || createMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Last opp bilde
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
        </div>

        {/* Image grid */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !backgrounds || backgrounds.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Ingen bakgrunnsbilder lagt til ennå.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {backgrounds.map((bg) => (
              <div
                key={bg.id}
                className={`relative group rounded-lg overflow-hidden border-2 transition-colors ${
                  bg.is_default ? 'border-primary' : 'border-transparent hover:border-muted-foreground/30'
                }`}
              >
                <img
                  src={bg.image_url}
                  alt={bg.name}
                  className="w-full aspect-[4/3] object-cover"
                />
                {bg.is_default && (
                  <div className="absolute top-1 left-1 bg-primary text-primary-foreground rounded-full p-1">
                    <Check className="h-3 w-3" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {!bg.is_default && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setDefaultMutation.mutate(bg.id)}
                      disabled={setDefaultMutation.isPending}
                    >
                      <Star className="h-3 w-3 mr-1" />
                      Standard
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Slett bakgrunnsbilde?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Er du sikker på at du vil slette «{bg.name}»?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Avbryt</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate(bg.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Slett
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <p className="text-xs truncate px-2 py-1 bg-background/80">
                  {bg.name}
                  {bg.is_default && <span className="text-primary ml-1">(standard)</span>}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
