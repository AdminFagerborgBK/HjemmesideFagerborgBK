import { useState } from 'react';
import { Mail, Send, RotateCcw, Eye, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

interface EmailSettings {
  accountNumber: string;
  membershipFee: string;
  kidPrefix: string;
}

interface MemberEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedMembers: Member[];
  settings: EmailSettings;
  updateSettings: (updates: Partial<EmailSettings>) => void;
  subject: string;
  setSubject: (subject: string) => void;
  onSend: () => void;
  onReset: () => void;
  isSending: boolean;
  generatePreview: (member: Member) => string;
  generateKid: (member: Member) => string;
}

export function MemberEmailDialog({
  open,
  onOpenChange,
  selectedMembers,
  settings,
  updateSettings,
  subject,
  setSubject,
  onSend,
  onReset,
  isSending,
  generatePreview,
  generateKid,
}: MemberEmailDialogProps) {
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
            Send medlems-e-post
          </DialogTitle>
          <DialogDescription>
            Sender til {selectedMembers.length} medlem{selectedMembers.length !== 1 ? 'mer' : ''}: {' '}
            {selectedMembers.slice(0, 3).map(m => m.email).join(', ')}
            {selectedMembers.length > 3 && ` og ${selectedMembers.length - 3} til...`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-auto">
          <div className="space-y-2">
            <Label htmlFor="subject">Emne</Label>
            <Input
              id="subject"
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
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="accountNumber">Kontonummer</Label>
                  <Input
                    id="accountNumber"
                    value={settings.accountNumber}
                    onChange={(e) => updateSettings({ accountNumber: e.target.value })}
                    placeholder="XXXX.XX.XXXXX"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="membershipFee">Medlemsavgift (kr)</Label>
                  <Input
                    id="membershipFee"
                    type="number"
                    value={settings.membershipFee}
                    onChange={(e) => updateSettings({ membershipFee: e.target.value })}
                    placeholder="500"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="kidPrefix">KID-prefiks (år)</Label>
                  <Input
                    id="kidPrefix"
                    value={settings.kidPrefix}
                    onChange={(e) => updateSettings({ kidPrefix: e.target.value })}
                    placeholder="2026"
                    maxLength={4}
                  />
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <h4 className="font-medium text-sm">KID-nummer eksempel</h4>
                <p className="text-sm text-muted-foreground">
                  Hvert medlem får et unikt KID-nummer basert på prefiksen og deres medlems-ID.
                </p>
                <p className="font-mono text-sm bg-background px-2 py-1 rounded inline-block">
                  Eksempel: {generateKid(previewMember)}
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <h4 className="font-medium text-sm">E-posten inneholder</h4>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>Fagerborg BK logo (topp og bunn)</li>
                  <li>Personlig hilsen til medlemmet</li>
                  <li>Betalingsinformasjon med kontonummer og beløp</li>
                  <li>Unikt KID-nummer for hvert medlem</li>
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

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onReset} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Tilbakestill
          </Button>
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
