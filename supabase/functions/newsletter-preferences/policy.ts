import { z } from 'npm:zod@3.25.76';

export const PreferenceUpdate = z.object({
  newsletter_opt_out: z.boolean(),
  interests: z.array(z.enum(['kamper', 'ungdom', 'dugnad', 'arrangementer', 'sponsor'])).max(5).optional(),
});