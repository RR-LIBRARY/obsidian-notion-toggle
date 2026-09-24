import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface PluginKeySummary {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  requestCount: number;
}

export interface UsagePoint {
  day: string;
  count: number;
}

export interface UsageSummary {
  total30d: number;
  byKind: Array<{ kind: string; count: number }>;
  byDay: UsagePoint[];
  errors30d: number;
  cached30d: number;
  avgLatencyMs: number | null;
}

export interface RecentRequest {
  id: string;
  kind: string;
  provider: string;
  query: string;
  status: string;
  latencyMs: number | null;
  error: string | null;
  createdAt: string;
  keyId: string | null;
}

export const listPluginKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PluginKeySummary[]> => {
    const { data, error } = await context.supabase
      .from("plugin_keys")
      .select("id, name, key_prefix, created_at, last_used_at, revoked_at, request_count")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((k) => ({
      id: k.id,
      name: k.name,
      keyPrefix: k.key_prefix,
      createdAt: k.created_at,
      lastUsedAt: k.last_used_at,
      revokedAt: k.revoked_at,
      requestCount: k.request_count,
    }));
  });

export const createPluginKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ name: z.string().trim().min(1).max(60) }).parse(data))
  .handler(async ({ data, context }): Promise<{ key: PluginKeySummary; plaintext: string }> => {
    const { count } = await context.supabase
      .from("plugin_keys")
      .select("id", { count: "exact", head: true })
      .is("revoked_at", null);
    if ((count ?? 0) >= 10) throw new Error("You can have at most 10 active keys. Revoke one first.");
    const { mintPluginKey } = await import("@/lib/research/auth.server");
    const minted = await mintPluginKey();
    const { data: row, error } = await context.supabase
      .from("plugin_keys")
      .insert({ user_id: context.userId, name: data.name, key_prefix: minted.prefix, key_hash: minted.hash })
      .select("id, name, key_prefix, created_at, last_used_at, revoked_at, request_count")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Could not create key");
    return {
      plaintext: minted.plaintext,
      key: {
        id: row.id,
        name: row.name,
        keyPrefix: row.key_prefix,
        createdAt: row.created_at,
        lastUsedAt: row.last_used_at,
        revokedAt: row.revoked_at,
        requestCount: row.request_count,
      },
    };
  });

export const revokePluginKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("plugin_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .is("revoked_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const renamePluginKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(60) }).parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.from("plugin_keys").update({ name: data.name }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getUsageSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UsageSummary> => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const { data, error } = await context.supabase
      .from("research_requests")
      .select("kind, status, latency_ms, created_at")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const byKindMap = new Map<string, number>();
    const byDayMap = new Map<string, number>();
    let errors = 0;
    let cached = 0;
    let latencySum = 0;
    let latencyN = 0;
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      byDayMap.set(d.toISOString().slice(0, 10), 0);
    }
    for (const r of rows) {
      byKindMap.set(r.kind, (byKindMap.get(r.kind) ?? 0) + 1);
      const day = r.created_at.slice(0, 10);
      byDayMap.set(day, (byDayMap.get(day) ?? 0) + 1);
      if (r.status === "error") errors++;
      if (r.status === "cached") cached++;
      if (typeof r.latency_ms === "number") {
        latencySum += r.latency_ms;
        latencyN++;
      }
    }
    return {
      total30d: rows.length,
      byKind: Array.from(byKindMap.entries())
        .map(([kind, count]) => ({ kind, count }))
        .sort((a, b) => b.count - a.count),
      byDay: Array.from(byDayMap.entries()).map(([day, count]) => ({ day, count })),
      errors30d: errors,
      cached30d: cached,
      avgLatencyMs: latencyN ? Math.round(latencySum / latencyN) : null,
    };
  });

export const listRecentRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RecentRequest[]> => {
    const { data, error } = await context.supabase
      .from("research_requests")
      .select("id, kind, provider, query, status, latency_ms, error, created_at, key_id")
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id,
      kind: r.kind,
      provider: r.provider,
      query: r.query,
      status: r.status,
      latencyMs: r.latency_ms,
      error: r.error,
      createdAt: r.created_at,
      keyId: r.key_id,
    }));
  });
