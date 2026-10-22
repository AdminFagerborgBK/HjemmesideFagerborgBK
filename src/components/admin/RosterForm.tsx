import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ImageUpload } from './ImageUpload';
import { CareerHistoryEditor } from './CareerHistoryEditor';
import { SiteRosterMember, CareerEntry, ROSTER_CATEGORIES, useCreateSiteRosterMember, useUpdateSiteRosterMember, useSiteRoster } from '@/hooks/useSiteRoster';
import { Loader2 } from 'lucide-react';

interface RosterFormProps {
  member?: SiteRosterMember | null;
  mode: 'create' | 'edit';
}

const STAFF_CATEGORIES = ['Trenere', 'Ledere', 'Styret', 'Andre'];

export const RosterForm = ({ member, mode }: RosterFormProps) => {
  const navigate = useNavigate();
  const createMember = useCreateSiteRosterMember();
  const updateMember = useUpdateSiteRosterMember();
  const { data: allMembers } = useSiteRoster(true);

  const [formData, setFormData] = useState({
    full_name: '',
    role_or_position: '',
    category: 'Angrep',
    team: 'A-laget',
    shirt_number: null as number | null,
    photo_url: null as string | null,
    status: 'active' as 'active' | 'inactive',
    contact_email: '' as string,
    contact_phone: '' as string,
    show_email: false,
    show_phone: false,
    career_history: [] as CareerEntry[],
    fotball_no_url: '' as string,
    nifs_url: '' as string,
    birth_date: null as string | null,
  });

  useEffect(() => {
    if (member) {
      setFormData({
        full_name: member.full_name,
        role_or_position: member.role_or_position || '',
        category: member.category,
        team: member.team || 'A-laget',
        shirt_number: member.shirt_number,
        photo_url: member.photo_url,
        status: member.status,
        contact_email: member.contact_email || '',
        contact_phone: member.contact_phone || '',
        show_email: member.show_email ?? false,
        show_phone: member.show_phone ?? false,
        career_history: member.career_history || [],
        fotball_no_url: member.fotball_no_url || '',
        nifs_url: member.nifs_url || '',
        birth_date: member.birth_date || null,
      });
    }
  }, [member]);

  const isStaffCategory = STAFF_CATEGORIES.includes(formData.category);

  // Calculate taken shirt numbers for the current team
  const takenNumbers = new Set(
    (allMembers || [])
      .filter(m => m.team === formData.team && m.shirt_number != null && m.id !== member?.id)
      .map(m => m.shirt_number!)
  );
  const availableNumbers = Array.from({ length: 99 }, (_, i) => i + 1).filter(n => !takenNumbers.has(n));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      ...formData,
      contact_email: formData.contact_email || null,
      contact_phone: formData.contact_phone || null,
      fotball_no_url: formData.fotball_no_url || null,
      nifs_url: formData.nifs_url || null,
    };

    if (mode === 'create') {
      await createMember.mutateAsync(payload);
    } else if (member) {
      await updateMember.mutateAsync({ id: member.id, ...payload });
    }
    
    navigate('/admin/roster');
  };

  const isLoading = createMember.isPending || updateMember.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="full_name">Fullt navn *</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
              required
            />
          </div>

          <div>
            <Label htmlFor="role_or_position">Rolle/Posisjon</Label>
            <Input
              id="role_or_position"
              value={formData.role_or_position}
              onChange={(e) => setFormData(prev => ({ ...prev, role_or_position: e.target.value }))}
              placeholder={isStaffCategory ? 'f.eks. Hovedtrener, Keepertrener...' : 'f.eks. Keeper, Midtbane...'}
            />
          </div>

          <div>
            <Label htmlFor="category">Kategori *</Label>
            <Select 
              value={formData.category} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROSTER_CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!isStaffCategory && (
            <div>
              <Label htmlFor="team">Lag *</Label>
              <Select 
                value={formData.team} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, team: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A-laget">A-laget</SelectItem>
                  <SelectItem value="B-laget">B-laget</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {!isStaffCategory && (
            <div>
              <Label htmlFor="shirt_number">Draktnummer</Label>
              <Select
                value={formData.shirt_number?.toString() || 'none'}
                onValueChange={(value) => setFormData(prev => ({
                  ...prev,
                  shirt_number: value === 'none' ? null : parseInt(value)
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Velg nummer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ingen</SelectItem>
                  {formData.shirt_number && !availableNumbers.includes(formData.shirt_number) && (
                    <SelectItem value={formData.shirt_number.toString()}>
                      {formData.shirt_number} (nåværende)
                    </SelectItem>
                  )}
                  {availableNumbers.map(n => (
                    <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="status">Status</Label>
            <Select 
              value={formData.status} 
              onValueChange={(value: 'active' | 'inactive') => setFormData(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Aktiv</SelectItem>
                <SelectItem value="inactive">Inaktiv</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isStaffCategory && (
          <div className="border-t pt-4 mt-4 space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Kontaktinformasjon</h3>
            
            <div className="space-y-2">
              <Label htmlFor="contact_email">E-post</Label>
              <Input
                id="contact_email"
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
                placeholder="navn@eksempel.no"
              />
              <div className="flex items-center gap-2">
                <Switch
                  id="show_email"
                  checked={formData.show_email}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, show_email: checked }))}
                />
                <Label htmlFor="show_email" className="text-sm text-muted-foreground">Vis e-post på nettsiden</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_phone">Mobilnummer</Label>
              <Input
                id="contact_phone"
                type="tel"
                value={formData.contact_phone}
                onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
                placeholder="+47 123 45 678"
              />
              <div className="flex items-center gap-2">
                <Switch
                  id="show_phone"
                  checked={formData.show_phone}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, show_phone: checked }))}
                />
                <Label htmlFor="show_phone" className="text-sm text-muted-foreground">Vis mobilnummer på nettsiden</Label>
              </div>
            </div>
          </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <Label>Bilde</Label>
            <ImageUpload
              value={formData.photo_url}
              onChange={(url) => setFormData(prev => ({ ...prev, photo_url: url }))}
              folder="roster"
            />
          </div>

          {!isStaffCategory && (
            <div className="border-t pt-4 mt-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Spillerens CV</h3>
              <CareerHistoryEditor
                career={formData.career_history}
                onChange={(career) => setFormData(prev => ({ ...prev, career_history: career }))}
                fotballNoUrl={formData.fotball_no_url}
                onUrlChange={(url) => setFormData(prev => ({ ...prev, fotball_no_url: url }))}
                onNameScraped={(name) => {
                  if (!formData.full_name) {
                    setFormData(prev => ({ ...prev, full_name: name }));
                  }
                }}
                birthDate={formData.birth_date}
                onBirthDateChange={(date) => setFormData(prev => ({ ...prev, birth_date: date }))}
                nifsUrl={formData.nifs_url}
                onNifsUrlChange={(url) => setFormData(prev => ({ ...prev, nifs_url: url }))}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-4">
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {mode === 'create' ? 'Legg til person' : 'Lagre endringer'}
        </Button>
        <Button type="button" variant="outline" onClick={() => navigate('/admin/roster')}>
          Avbryt
        </Button>
      </div>
    </form>
  );
};
