REVOKE ALL ON FUNCTION public.reschedule_scheduled_publish() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_scheduled_publish() TO service_role;
COMMENT ON FUNCTION public.reschedule_scheduled_publish() IS 'Service-only event-driven scheduling; never callable by untrusted authenticated users.';