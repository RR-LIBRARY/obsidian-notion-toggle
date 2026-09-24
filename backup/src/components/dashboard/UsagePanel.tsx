import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format, formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { getUsageSummary, listRecentRequests } from "@/lib/keys.functions";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<string, string> = {
  search: "Web search",
  perplexity: "Perplexity",
  extract: "Extract",
  answer: "Cited answer",
  factcheck: "Fact-check",
  recall: "Recall cards",
  task_create: "Deep research",
  task_poll: "Run poll",
};

export function UsagePanel() {
  const summaryFn = useServerFn(getUsageSummary);
  const recentFn = useServerFn(listRecentRequests);
  const summary = useQuery({ queryKey: ["usage-summary"], queryFn: () => summaryFn(), refetchInterval: 30_000 });
  const recent = useQuery({ queryKey: ["usage-recent"], queryFn: () => recentFn(), refetchInterval: 30_000 });

  const s = summary.data;
  const max = Math.max(1, ...(s?.byDay.map((d) => d.count) ?? [1]));

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Requests · 30 days" value={s ? s.total30d.toLocaleString() : null} />
        <Stat label="Served from cache" value={s ? `${s.total30d ? Math.round((s.cached30d / s.total30d) * 100) : 0}%` : null} />
        <Stat label="Errors" value={s ? s.errors30d.toLocaleString() : null} tone={s && s.errors30d > 0 ? "warn" : "default"} />
        <Stat label="Avg latency" value={s ? (s.avgLatencyMs === null ? "—" : `${(s.avgLatencyMs / 1000).toFixed(1)} s`) : null} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="paper-card p-5">
          <h2 className="text-xl">Daily volume</h2>
          <p className="mt-1 text-sm text-muted-foreground">Requests from all keys plus the playground, last 30 days.</p>
          {summary.isLoading ? (
            <Skeleton className="mt-4 h-40 w-full" />
          ) : (
            <div className="mt-6 flex h-40 items-end gap-[3px]" role="img" aria-label="Daily request volume">
              {(s?.byDay ?? []).map((d) => (
                <div key={d.day} className="group relative flex h-full flex-1 items-end">
                  <div
                    className={cn("w-full rounded-t-sm transition-colors", d.count ? "bg-amber group-hover:bg-amber-foreground" : "bg-muted")}
                    style={{ height: `${Math.max(d.count ? 6 : 2, (d.count / max) * 100)}%` }}
                  />
                  <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground group-hover:block">
                    {format(new Date(d.day), "MMM d")} · {d.count}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
            <span>{s?.byDay[0] ? format(new Date(s.byDay[0].day), "MMM d") : ""}</span>
            <span>today</span>
          </div>
        </section>

        <section className="paper-card p-5">
          <h2 className="text-xl">By operation</h2>
          {summary.isLoading ? (
            <Skeleton className="mt-4 h-40 w-full" />
          ) : s && s.byKind.length ? (
            <ul className="mt-4 space-y-2.5">
              {s.byKind.map((k) => (
                <li key={k.kind}>
                  <div className="flex justify-between text-sm">
                    <span>{KIND_LABEL[k.kind] ?? k.kind}</span>
                    <span className="text-muted-foreground">{k.count}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(k.count / (s.byKind[0]?.count ?? 1)) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Nothing yet. Run something in the playground or from Obsidian.</p>
          )}
        </section>
      </div>

      <section className="paper-card overflow-hidden">
        <div className="p-5 pb-3">
          <h2 className="text-xl">Recent requests</h2>
        </div>
        {recent.isLoading ? (
          <div className="space-y-2 p-5 pt-0">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : recent.data && recent.data.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Operation</th>
                  <th className="px-3 py-2 font-medium">Query</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-5 py-2 text-right font-medium">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recent.data.map((r) => (
                  <tr key={r.id} className="hover:bg-accent/40">
                    <td className="whitespace-nowrap px-5 py-2 text-muted-foreground">{formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}</td>
                    <td className="whitespace-nowrap px-3 py-2">{KIND_LABEL[r.kind] ?? r.kind}</td>
                    <td className="max-w-[320px] truncate px-3 py-2" title={r.query}>
                      {r.query}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs",
                          r.status === "ok" && "bg-success-soft",
                          r.status === "cached" && "bg-accent",
                          r.status === "error" && "bg-danger-soft text-destructive",
                        )}
                        title={r.error ?? undefined}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-2 text-right font-mono text-xs text-muted-foreground">
                      {r.latencyMs === null ? "—" : `${r.latencyMs} ms`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 pb-5 text-sm text-muted-foreground">No requests logged yet.</p>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, tone = "default" }: { label: string; value: string | null; tone?: "default" | "warn" }) {
  return (
    <div className="paper-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      {value === null ? (
        <Skeleton className="mt-2 h-7 w-20" />
      ) : (
        <p className={cn("mt-1 font-display text-2xl", tone === "warn" && "text-destructive")}>{value}</p>
      )}
    </div>
  );
}
