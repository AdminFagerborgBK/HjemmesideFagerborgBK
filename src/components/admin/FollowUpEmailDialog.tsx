import { useState } from 'react';
import { Mail, Send, Eye, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface FollowUpSettings {
  spondLink: string;
  customMessage: string;
}

interface FollowUpEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedMembers: Member[];
  settings: FollowUpSettings;
  updateSettings: (updates: Partial<FollowUpSettings>) => void;
  subject: string;
  setSubject: (subject: string) => void;
  onSend: () => void;
  isSending: boolean;
  generatePreview: (member: Member) => string;
}

export function FollowUpEmailDialog({
  open,
  onOpenChange,
  selectedMembers,
  settings,
  updateSettings,
  subject,
  setSubject,
  onSend,
  isSending,
  generatePreview,
}: FollowUpEmailDialogProps) {
  const [activeTab, setActiveTab] = useState<'settings' | 'preview'>('settings');
  
  const previewMember = selectedMembers[0] || {
    id: 'preview-id-12345',
    first_name: 'Ola',
    last_name: 'Nordmann',
    email: 'ola@eksempel.no',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send oppfølgings-e-post (Spond)
          </DialogTitle>
          <DialogDescription>
            Sender til {selectedMembers.length} medlem{selectedMembers.length !== 1 ? 'mer' : ''}: {' '}
            {selectedMembers.slice(0, 3).map(m => m.email).join(', ')}
            {selectedMembers.length > 3 && ` og ${selectedMembers.length - 3} til...`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-auto">
          <div className="space-y-2">
            <Label htmlFor="followup-subject">Emne</Label>
            <Input
              id="followup-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="E-postens emne"
            />
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'settings' | 'preview')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="settings" className="gap-2">
                <Settings2 className="h-4 w-4" />
                Innstillinger
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-2">
                <Eye className="h-4 w-4" />
                Forhåndsvisning
              </TabsTrigger>
            </TabsList>

            <TabsContent value="settings" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="spondLink">Spond-lenke</Label>
                <Input
                  id="spondLink"
                  value={settings.spondLink}
                  onChange={(e) => updateSettings({ spondLink: e.target.value })}
                  placeholder="https://spond.com/..."
                  type="url"
                />
                <p className="text-xs text-muted-foreground">
                  Lenken til Spond-gruppen der medlemmer kan melde seg inn og betale.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customMessage">Tilleggsmelding (valgfritt)</Label>
                <Textarea
                  id="customMessage"
                  value={settings.customMessage}
                  onChange={(e) => updateSettings({ customMessage: e.target.value })}
                  placeholder="Skriv en ekstra beskjed som vises i e-posten..."
                  rows={3}
                />
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <h4 className="font-medium text-sm">E-posten inneholder</h4>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>Fagerborg BK logo (topp og bunn)</li>
                  <li>Personlig velkomsthilsen</li>
                  <li>Spond-lenke med knapp</li>
                  <li>Informasjon om hva Spond brukes til</li>
                  {settings.customMessage && <li>Din tilleggsmelding</li>}
                  <li>Kontaktinformasjon</li>
                </ul>
              </div>
            </TabsContent>

            <TabsContent value="preview">
              <div className="border rounded-lg p-4 bg-white min-h-[400px] overflow-auto">
                <div 
                  dangerouslySetInnerHTML={{ __html: generatePreview(previewMember) }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Forhåndsvisning for: {previewMember.first_name} {previewMember.last_name} ({previewMember.email})
              </p>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button 
            onClick={onSend} 
            disabled={isSending || selectedMembers.length === 0}
            className="gap-2"
          >
            {isSending ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Sender...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send til {selectedMembers.length} medlem{selectedMembers.length !== 1 ? 'mer' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
