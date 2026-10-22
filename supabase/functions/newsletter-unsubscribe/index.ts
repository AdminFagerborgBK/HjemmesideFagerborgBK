import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyNewsletterToken } from '../_shared/newsletterToken.mjs';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// GET never changes preferences: mail scanners cannot silently unsubscribe.
serve(async req => {
  const headers={...corsHeaders,'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'};
  if(req.method==='OPTIONS') return new Response(null,{headers});
  if(req.method!=='GET') return new Response('Method not allowed',{status:405,headers});
  try {
    const token=new URL(req.url).searchParams.get('token');
    const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if(!secret) throw new Error('Tjenesten er ikke konfigurert');
    if(!await verifyNewsletterToken(token,secret)) return new Response('Ugyldig eller utløpt lenke. Bruk lenken fra et nyere nyhetsbrev.',{status:403,headers});
    return new Response(null,{status:302,headers:{...headers,Location:`https://fagerborgbk.no/nyhetsbrev#token=${token}`}});
  } catch {
    return new Response('Kunne ikke kontrollere lenken. Prøv igjen senere.',{status:500,headers});
  }
});
