ALTER TABLE public.newsletters ADD COLUMN delivery_state text NOT NULL DEFAULT 'idle' CHECK(delivery_state IN ('idle','sending','partial','sent'));
UPDATE public.newsletters SET delivery_state='sent' WHERE status='sent';
COMMENT ON COLUMN public.newsletters.delivery_state IS 'Atomic send claim and partial-delivery recovery state, separate from editorial status.';