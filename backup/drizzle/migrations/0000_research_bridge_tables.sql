-- Plugin access keys (plaintext never stored; only SHA-256 hash)
CREATE TABLE public.plugin_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Obsidian',
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  request_count integer NOT NULL DEFAULT 0
);
CREATE INDEX plugin_keys_user_id_idx ON public.plugin_keys (user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plugin_keys TO authenticated;
GRANT ALL ON public.plugin_keys TO service_role;
ALTER TABLE public.plugin_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plugin_keys_select_own" ON public.plugin_keys
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "plugin_keys_insert_own" ON public.plugin_keys
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "plugin_keys_update_own" ON public.plugin_keys
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "plugin_keys_delete_own" ON public.plugin_keys
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Usage log written by the bridge (service role) and read by owners
CREATE TABLE public.research_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  key_id uuid REFERENCES public.plugin_keys(id) ON DELETE SET NULL,
  kind text NOT NULL,
  provider text NOT NULL,
  query text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'ok',
  latency_ms integer,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX research_requests_user_created_idx ON public.research_requests (user_id, created_at DESC);
GRANT SELECT ON public.research_requests TO authenticated;
GRANT ALL ON public.research_requests TO service_role;
ALTER TABLE public.research_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "research_requests_select_own" ON public.research_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Long-running deep research runs (Parallel Task API)
CREATE TABLE public.research_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  key_id uuid REFERENCES public.plugin_keys(id) ON DELETE SET NULL,
  run_id text NOT NULL UNIQUE,
  objective text NOT NULL,
  processor text NOT NULL DEFAULT 'base',
  preset text NOT NULL DEFAULT 'report',
  status text NOT NULL DEFAULT 'queued',
  note_path text,
  result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX research_runs_user_created_idx ON public.research_runs (user_id, created_at DESC);
GRANT SELECT ON public.research_runs TO authenticated;
GRANT ALL ON public.research_runs TO service_role;
ALTER TABLE public.research_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "research_runs_select_own" ON public.research_runs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Shared short-lived result cache (bridge only)
CREATE TABLE public.research_cache (
  cache_key text PRIMARY KEY,
  kind text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX research_cache_expires_idx ON public.research_cache (expires_at);
GRANT ALL ON public.research_cache TO service_role;
ALTER TABLE public.research_cache ENABLE ROW LEVEL SECURITY;

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER research_runs_set_updated_at
  BEFORE UPDATE ON public.research_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();