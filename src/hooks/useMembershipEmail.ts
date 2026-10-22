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

interface EmailSettings {
  accountNumber: string;
  membershipFee: string;
  kidPrefix: string;
}

const LOGO_URL = 'https://elvltuhjskdgboshavdx.supabase.co/storage/v1/object/public/site-media/email%2Ffagerborg-logo.png';

const generateKidNumber = (prefix: string, memberId: string) => {
  // Simple KID generation: prefix + last 5 chars of member ID + check digit
  const idPart = memberId.replace(/-/g, '').slice(-5).toUpperCase();
  const numericId = idPart.split('').map(c => {
    const code = c.charCodeAt(0);
    return code >= 48 && code <= 57 ? c : (code - 55).toString();
  }).join('').slice(0, 5);
  
  // Mod10 check digit
  const fullNumber = prefix + numericId;
  let sum = 0;
  let alternate = false;
  for (let i = fullNumber.length - 1; i >= 0; i--) {
    let n = parseInt(fullNumber[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  
  return fullNumber + checkDigit;
};

const generateEmailHtml = (member: Member, settings: EmailSettings) => {
  const fullName = `${member.first_name} ${member.last_name}`.trim();
  const year = new Intl.DateTimeFormat('en', {timeZone:'Europe/Oslo',year:'numeric'}).format(new Date());
  const kidNumber = generateKidNumber(settings.kidPrefix, member.id);
  
  return `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 24px;">
    <img src="${LOGO_URL}" alt="Fagerborg BK" style="width: 120px; height: auto;" />
  </div>
  
  <h2 style="color: #1a1a1a; margin-bottom: 16px;">Medlemskap i Fagerborg BK</h2>
  
  <p>Hei ${fullName},</p>
  
  <p>Takk for at du har meldt deg inn i Fagerborg BK!</p>
  
  <p>For å fullføre medlemskapet ditt for ${year}, vennligst betal medlemsavgiften til:</p>
  
  <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
    <p style="margin: 4px 0;"><strong>Kontonummer:</strong> ${settings.accountNumber}</p>
    <p style="margin: 4px 0;"><strong>Beløp:</strong> ${settings.membershipFee} kr</p>
    <p style="margin: 4px 0;"><strong>KID-nummer:</strong> ${kidNumber}</p>
  </div>
  
  <p><em>Viktig: Oppgi betalingsreferansen slik at klubben kan finne innbetalingen din.</em></p>
  
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

export function useMembershipEmail() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<EmailSettings>({
    accountNumber: '1503.72.32329',
    membershipFee: '500',
    kidPrefix: new Intl.DateTimeFormat('en', {timeZone:'Europe/Oslo',year:'numeric'}).format(new Date()),
  });
  const [subject, setSubject] = useState('Medlemskap i Fagerborg BK');

  const updateSettings = (updates: Partial<EmailSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  const generateHtmlForMember = (member: Member) => {
    return generateEmailHtml(member, settings);
  };

  const generateKidForMember = (member: Member) => {
    return generateKidNumber(settings.kidPrefix, member.id);
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
          title: 'E-post sendt!', 
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

  const resetSettings = () => {
    setSettings({
      accountNumber: '1503.72.32329',
      membershipFee: '500',
      kidPrefix: new Intl.DateTimeFormat('en', {timeZone:'Europe/Oslo',year:'numeric'}).format(new Date()),
    });
    setSubject('Medlemskap i Fagerborg BK');
  };

  return {
    settings,
    updateSettings,
    subject,
    setSubject,
    generateHtmlForMember,
    generateKidForMember,
    sendEmails,
    resetSettings,
  };
}
