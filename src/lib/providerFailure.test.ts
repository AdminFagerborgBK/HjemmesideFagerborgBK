import {it,expect} from 'vitest';
import {providerFailure} from '../../supabase/functions/_shared/providerFailure';

it('provider diagnostics expose only the service and validated HTTP status',()=>{
  expect(providerFailure('Facebook',403)).toBe('Facebook avviste forespørselen (HTTP 403). Kontroller tilkoblingen før du prøver igjen.');
  expect(providerFailure('Resend',NaN)).toBe('Resend avviste forespørselen (HTTP 502). Kontroller tilkoblingen før du prøver igjen.');
});