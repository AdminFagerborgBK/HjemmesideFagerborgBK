import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSitePages, useSitePage, useUpdateSitePage } from '@/hooks/useSitePages';
import { Loader2, Save, FileEdit } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const PAGE_KEYS = ['home', 'about', 'contact', 'history', 'facilities', 'records', 'standings_history'] as const;
const PAGE_LABELS: Record<string, string> = {
  home: 'Hjemmeside',
  about: 'Om klubben',
  contact: 'Kontakt',
  history: 'Historie',
  facilities: 'Bane & Anlegg',
  records: 'Klubbrekorder',
  standings_history: 'Tabellhistorikk',
};

const PageEditor = ({ pageKey }: { pageKey: string }) => {
  const { data: page, isLoading } = useSitePage(pageKey);
  const updatePage = useUpdateSitePage();
  
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [initialized, setInitialized] = useState(false);

  // Initialize form when page data loads
  if (page && !initialized) {
    setTitle(page.title);
    setBody(page.body || '');
    setInitialized(true);
  }

  const handleSave = async () => {
    await updatePage.mutateAsync({ key: pageKey, title, body });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor={`title-${pageKey}`}>Sidetittel</Label>
        <Input
          id={`title-${pageKey}`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor={`body-${pageKey}`}>Innhold (Markdown)</Label>
        <Textarea
          id={`body-${pageKey}`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={15}
          placeholder="Skriv innholdet her..."
        />
      </div>
      <Button onClick={handleSave} disabled={updatePage.isPending}>
        {updatePage.isPending ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Save className="h-4 w-4 mr-2" />
        )}
        Lagre endringer
      </Button>
    </div>
  );
};

const AdminPages = () => {
  return (
    <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Sider</h1>
            <p className="text-muted-foreground">Rediger statiske sider som Om klubben, Kontakt, osv.</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileEdit className="h-5 w-5" />
                Rediger sider
              </CardTitle>
              <CardDescription>
                Velg en side for å redigere innholdet
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="about">
                <TabsList className="mb-6">
                  {PAGE_KEYS.map(key => (
                    <TabsTrigger key={key} value={key}>
                      {PAGE_LABELS[key]}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {PAGE_KEYS.map(key => (
                  <TabsContent key={key} value={key}>
                    <PageEditor pageKey={key} />
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
  );
};

export default AdminPages;
