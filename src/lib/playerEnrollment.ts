import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';
export async function onboarding<T = any>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('player-onboarding', { body });
  if (error) {
    let message = error.message;
    if (error instanceof FunctionsHttpError) { try { message = (await error.context.json()).error || message; } catch { /* preserve original */ } }
    throw new Error(message);
  }
  return data as T;
}
export const planLabels = { annual: 'Hele årsbeløpet', quarterly: 'Fire kvartalsvise betalinger', monthly: 'Tolv månedlige betalinger' };
export const money = (ore: number) => new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK' }).format(ore / 100);