import { PreferenceUpdate } from './policy.ts';

Deno.test('omitted or malformed preference cannot silently opt a member in', () => {
  for (const body of [{}, {newsletter_opt_out:'false'}, {newsletter_opt_out:null}, {newsletter_opt_out:0}]) {
    if (PreferenceUpdate.safeParse(body).success) throw new Error('Malformed preference was accepted');
  }
});
Deno.test('explicit opt-out and valid interests are retained', () => {
  const input = PreferenceUpdate.parse({newsletter_opt_out:true,interests:['kamper','sponsor']});
  if (input.newsletter_opt_out !== true || input.interests?.join(',') !== 'kamper,sponsor') throw new Error('Preference changed');
});
Deno.test('unknown interests are rejected instead of discarded', () => {
  if (PreferenceUpdate.safeParse({newsletter_opt_out:false,interests:['unknown']}).success) throw new Error('Unknown interest was accepted');
});