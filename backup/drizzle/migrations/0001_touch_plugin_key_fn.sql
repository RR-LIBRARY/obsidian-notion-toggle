CREATE OR REPLACE FUNCTION public.touch_plugin_key(_key_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.plugin_keys
  SET last_used_at = now(), request_count = request_count + 1
  WHERE id = _key_id;
$$;
REVOKE ALL ON FUNCTION public.touch_plugin_key(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.touch_plugin_key(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.touch_plugin_key(uuid) TO service_role;