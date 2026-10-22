import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

const LOGO_URL = 'https://elvltuhjskdgboshavdx.supabase.co/storage/v1/object/public/site-media/email%2Ffagerborg-logo.png';

const generateFollowUpHtml = (member: Member, settings: FollowUpSettings) => {
  const fullName = `${member.first_name} ${member.last_name}`.trim();
  
  const spondSection = settings.spondLink
    ? `<p>For å fullføre registreringen og betale medlemsavgiften, meld deg inn via Spond:</p>
       <div style="text-align: center; margin: 24px 0;">
         <a href="${settings.spondLink}" style="background-color: #2a6e3f; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
           Meld deg inn via Spond
         </a>
       </div>
       <p style="color: #666; font-size: 13px;">Eller bruk denne lenken direkte: <a href="${settings.spondLink}" style="color: #2a6e3f;">${settings.spondLink}</a></p>`
    : '<p><em>Spond-lenken er ikke konfigurert ennå. Kontakt styret for informasjon om innmelding.</em></p>';

  const customSection = settings.customMessage
    ? `<div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
         <p style="margin: 0; white-space: pre-wrap;">${settings.customMessage}</p>
       </div>`
    : '';

  return `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 24px;">
    <img src="${LOGO_URL}" alt="Fagerborg BK" style="width: 120px; height: auto;" />
  </div>
  
  <h2 style="color: #1a1a1a; margin-bottom: 16px;">Velkommen til Fagerborg BK!</h2>
  
  <p>Hei ${fullName},</p>
  
  <p>Takk for at du har registrert deg som medlem i Fagerborg BK! 🎉</p>
  
  ${spondSection}

  ${customSection}
  
  <p>I Spond kan du:</p>
  <ul>
    <li>Betale medlemsavgiften enkelt</li>
    <li>Melde deg på treninger og kamper</li>
    <li>Holde deg oppdatert på klubbens aktiviteter</li>
    <li>Kommunisere med laget</li>
  </ul>
  
  <p>Ved spørsmål, ta kontakt på <a href="mailto:post@fagerborgbk.no" style="color: #2a6e3f;">post@fagerborgbk.no</a>.</p>
  
  <p style="margin-top: 32px;">Med vennlig hilsen,<br/><strong>Fagerborg BK</strong></p>
  
  <div style="text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e5e5;">
    <img src="${LOGO_URL}" alt="Fagerborg BK" style="width: 60px; height: auto; opacity: 0.7;" />
    <p style="color: #666; font-size: 12px; margin-top: 8px;">
      Fagerborg BK – Stiftet 1914
    </p>
  </div>
</div>`;
};

export function useFollowUpEmail() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<FollowUpSettings>({
    spondLink: '',
    customMessage: '',
  });
  const [subject, setSubject] = useState('Velkommen til Fagerborg BK – Meld deg inn via Spond');

  const updateSettings = (updates: Partial<FollowUpSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  const generateHtmlForMember = (member: Member) => {
    return generateFollowUpHtml(member, settings);
  };

  const sendEmails = useMutation({
    mutationFn: async (members: Member[]) => {
      const results = [];
      for (const member of members) {
        const html = generateHtmlForMember(member);
        
        const { data, error } = await supabase.functions.invoke('send-membership-email', {
          body: {
            to: [member.email],
            subject,
            html,
          },
        });
        
        if (error) {
          results.push({ email: member.email, success: false, error: error.message });
        } else {
          results.push({ email: member.email, success: true, ...data });
        }
      }
      
      return results;
    },
    onSuccess: (results) => {
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      if (failed === 0) {
        toast({ 
          title: 'Oppfølgings-e-post sendt!', 
          description: `${successful} e-post${successful > 1 ? 'er' : ''} ble sendt.` 
        });
      } else {
        toast({ 
          title: 'Delvis sendt', 
          description: `${successful} sendt, ${failed} feilet.`,
          variant: 'destructive'
        });
      }
    },
    onError: (error) => {
      toast({ 
        title: 'Feil ved sending', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });

  return {
    settings,
    updateSettings,
    subject,
    setSubject,
    generateHtmlForMember,
    sendEmails,
  };
}
