import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Shield, Search, Download, Trash2, User } from 'lucide-react';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';

const AdminGDPR = () => {
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [searching, setSearching] = useState(false);
  const queryClient = useQueryClient();

  const handleSearch = async () => {
    if (!searchEmail.trim()) {
      toast.error('Skriv inn en e-postadresse');
      return;
    }
    setSearching(true);
    try {
      // Search memberships
      // Escape LIKE wildcards to prevent pattern matching enumeration
      const escaped = searchEmail.trim().replace(/[%_\\]/g, '\\$&');
      const { data: members } = await supabase
        .from('memberships')
        .select('*')
        .ilike('email', `%${escaped}%`);

      setSearchResults(members || []);

      // Log the search/access request
      await supabase.from('activity_log').insert({
        type: 'gdpr_access',
        payload: { email: searchEmail.trim(), results_count: members?.length ?? 0 },
      });

      if (!members?.length) {
        toast.info('Ingen data funnet for denne e-postadressen');
      }
    } catch (err) {
      toast.error('Feil ved søk');
    } finally {
      setSearching(false);
    }
  };

  const handleExport = async () => {
    if (!searchResults?.length) return;
    const data = searchResults.map(m => ({
      Navn: `${m.first_name} ${m.last_name}`,
      Epost: m.email,
      Telefon: m.phone || '',
      Adresse: m.address || '',
      Postnummer: m.postal_code || '',
      By: m.city || '',
      Fødselsdato: m.birth_date || '',
      Medlemstype: m.membership_type,
      Status: m.status,
      Registrert: m.created_at,
    }));
    const csv = [
      Object.keys(data[0]).join(';'),
      ...data.map(row => Object.values(row).join(';'))
    ].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `persondata-${searchEmail.trim()}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    // Log the export
    await supabase.from('activity_log').insert({
      type: 'gdpr_export',
      payload: { email: searchEmail.trim(), records_exported: searchResults.length },
    });

    toast.success('Data eksportert');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Er du sikker på at du vil slette denne personens data? Dette kan ikke angres.')) return;
    try {
      const { error } = await supabase.functions.invoke('admin-memberships', {
        body: { action: 'delete', id },
      });
      if (error) throw error;
      
      // Log the deletion
      const deletedMember = searchResults?.find(m => m.id === id);
      await supabase.from('activity_log').insert({
        type: 'gdpr_delete',
        payload: { email: deletedMember?.email, member_id: id },
      });

      setSearchResults(prev => prev?.filter(m => m.id !== id) || null);
      toast.success('Persondata slettet');
      queryClient.invalidateQueries({ queryKey: ['admin-memberships'] });
    } catch (err) {
      toast.error('Kunne ikke slette data');
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Personvern (GDPR)</h1>
          <p className="text-muted-foreground">Håndter innsyns-, rettings- og slettekrav</p>
        </div>

        {/* Search */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Søk etter persondata
            </CardTitle>
            <CardDescription>
              Søk med e-postadresse for å finne lagrede personopplysninger
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  placeholder="e-post@eksempel.no"
                  value={searchEmail}
                  onChange={e => setSearchEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <Button onClick={handleSearch} disabled={searching}>
                <Search className="h-4 w-4 mr-2" />
                {searching ? 'Søker...' : 'Søk'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {searchResults !== null && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Resultater ({searchResults.length})
                </span>
                {searchResults.length > 0 && (
                  <Button variant="outline" size="sm" onClick={handleExport}>
                    <Download className="h-4 w-4 mr-2" />
                    Eksporter CSV
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {searchResults.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Ingen data funnet for «{searchEmail}»
                </p>
              ) : (
                <div className="space-y-4">
                  {searchResults.map(member => (
                    <div key={member.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{member.first_name} {member.last_name}</h3>
                          <p className="text-sm text-muted-foreground">{member.email}</p>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(member.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Slett
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                        {member.phone && (
                          <div><span className="text-muted-foreground">Telefon:</span> {member.phone}</div>
                        )}
                        {member.address && (
                          <div><span className="text-muted-foreground">Adresse:</span> {member.address}</div>
                        )}
                        {member.postal_code && (
                          <div><span className="text-muted-foreground">Postnr:</span> {member.postal_code} {member.city}</div>
                        )}
                        {member.birth_date && (
                          <div><span className="text-muted-foreground">Født:</span> {member.birth_date}</div>
                        )}
                        <div><span className="text-muted-foreground">Type:</span> {member.membership_type}</div>
                        <div><span className="text-muted-foreground">Status:</span> {member.status}</div>
                        <div>
                          <span className="text-muted-foreground">Registrert:</span>{' '}
                          {format(new Date(member.created_at), 'd. MMM yyyy', { locale: nb })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* GDPR Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              GDPR-rutiner
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• <strong>Innsynskrav:</strong> Søk opp personen og eksporter til CSV</p>
            <p>• <strong>Rettingskrav:</strong> Rediger opplysningene via Medlemmer-siden</p>
            <p>• <strong>Slettekrav:</strong> Søk opp og slett persondata med Slett-knappen</p>
            <p>• <strong>Frist:</strong> Krav skal besvares innen 30 dager (jf. GDPR art. 12)</p>
            <p>• <strong>Kontakt:</strong> Henvendelser sendes til post@fagerborgbk.no</p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminGDPR;
