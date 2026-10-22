import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ImageUpload } from './ImageUpload';
import { SiteSponsor, useCreateSiteSponsor, useUpdateSiteSponsor } from '@/hooks/useSiteSponsors';
import { Loader2 } from 'lucide-react';

interface SponsorFormProps {
  sponsor?: SiteSponsor | null;
  mode: 'create' | 'edit';
}

export const SponsorForm = ({ sponsor, mode }: SponsorFormProps) => {
  const navigate = useNavigate();
  const createSponsor = useCreateSiteSponsor();
  const updateSponsor = useUpdateSiteSponsor();

  const [formData, setFormData] = useState({
    name: '',
    logo_url: null as string | null,
    website_url: '',
    tier: 'partner' as 'main' | 'partner',
    description: '',
    sort_order: 0,
    is_active: true,
  });

  useEffect(() => {
    if (sponsor) {
      setFormData({
        name: sponsor.name,
        logo_url: sponsor.logo_url,
        website_url: sponsor.website_url || '',
        tier: sponsor.tier as 'main' | 'partner',
        description: sponsor.description || '',
        sort_order: sponsor.sort_order,
        is_active: sponsor.is_active,
      });
    }
  }, [sponsor]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === 'create') {
      await createSponsor.mutateAsync(formData);
    } else if (sponsor) {
      await updateSponsor.mutateAsync({ id: sponsor.id, ...formData });
    }
    
    navigate('/admin/sponsors');
  };

  const isLoading = createSponsor.isPending || updateSponsor.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Navn *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Sponsor AS"
              required
            />
          </div>

          <div>
            <Label htmlFor="tier">Type *</Label>
            <Select 
              value={formData.tier} 
              onValueChange={(value: 'main' | 'partner') => setFormData(prev => ({ ...prev, tier: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="main">Hovedsponsor</SelectItem>
                <SelectItem value="partner">Partner</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="website_url">Nettside</Label>
            <Input
              id="website_url"
              type="url"
              value={formData.website_url}
              onChange={(e) => setFormData(prev => ({ ...prev, website_url: e.target.value }))}
              placeholder="https://www.sponsor.no"
            />
          </div>

          <div>
            <Label htmlFor="description">Beskrivelse</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Kort beskrivelse av sponsor..."
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="sort_order">Rekkefølge</Label>
            <Input
              id="sort_order"
              type="number"
              min="0"
              value={formData.sort_order}
              onChange={(e) => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
            />
            <p className="text-xs text-muted-foreground mt-1">Lavere tall vises først</p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="is_active">Aktiv</Label>
              <p className="text-sm text-muted-foreground">Vis sponsor på nettsiden</p>
            </div>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Logo</Label>
            <ImageUpload
              value={formData.logo_url}
              onChange={(url) => setFormData(prev => ({ ...prev, logo_url: url }))}
              folder="sponsors"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Anbefalt: Kvadratisk eller liggende format, transparent bakgrunn (PNG)
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {mode === 'create' ? 'Legg til sponsor' : 'Lagre endringer'}
        </Button>
        <Button type="button" variant="outline" onClick={() => navigate('/admin/sponsors')}>
          Avbryt
        </Button>
      </div>
    </form>
  );
};
