import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { formatDistanceToNow } from "date-fns";
import { Check, Copy, Layers, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Markdown } from "@/components/Markdown";
import { listResearchRuns, playgroundPollTask } from "@/lib/playground.functions";
import { PRESET_META, type TaskRun } from "@/lib/research/schemas";
import { cn } from "@/lib/utils";

const ACTIVE = new Set(["queued", "running"]);

export function RunsPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listResearchRuns);
  const pollFn = useServerFn(playgroundPollTask);
  const runs = useQuery({ queryKey: ["research-runs"], queryFn: () => listFn() });
  const [selected, setSelected] = useState<string | null>(null);

  const items = runs.data?.runs ?? [];
  const activeIds = items.filter((r) => ACTIVE.has(r.status)).map((r) => r.runId);

  const poll = useMutation({
    mutationFn: (runId: string) => pollFn({ data: { runId } }),
    onSuccess: (run) => {
      qc.setQueryData<{ runs: TaskRun[] }>(["research-runs"], (prev) =>
        prev ? { runs: prev.runs.map((r) => (r.runId === run.runId ? run : r)) } : prev,
      );
      if (run.status === "completed") toast.success("Deep research finished", { description: run.objective.slice(0, 80) });
      if (run.status === "failed") toast.error("Deep research failed", { description: run.error ?? undefined });
    },
  });

  // Poll active runs every 6 s while this tab is mounted.
  useEffect(() => {
    if (!activeIds.length) return;
    const tick = () => activeIds.forEach((id) => poll.mutate(id));
    const t = window.setInterval(tick, 6000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIds.join("|")]);

  const current = items.find((r) => r.runId === selected) ?? items[0] ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <aside className="paper-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-lg">Runs</h2>
          <Button variant="ghost" size="sm" onClick={() => void runs.refetch()} disabled={runs.isFetching}>
            <RefreshCw className={cn(runs.isFetching && "animate-spin")} />
          </Button>
        </div>
        {runs.isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <span className="grid size-10 place-items-center rounded-full bg-amber-soft">
              <Layers className="size-5 text-amber-foreground" />
            </span>
            <p className="font-medium">No runs yet</p>
            <p className="text-sm text-muted-foreground">Start one from the Playground (Deep research) or from Obsidian.</p>
          </div>
        ) : (
          <ul className="max-h-[640px] divide-y divide-border overflow-y-auto">
            {items.map((r) => (
              <li key={r.runId}>
                <button
                  type="button"
                  onClick={() => setSelected(r.runId)}
                  className={cn("flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-accent/60", current?.runId === r.runId && "bg-accent")}
                >
                  <span className="line-clamp-2 text-sm font-medium">{r.objective}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <StatusDot status={r.status} />
                    {r.status} · {PRESET_META[r.preset].label} · {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className="paper-card min-h-[320px] p-5">
        {current ? <RunDetail run={current} polling={poll.isPending && poll.variables === current.runId} onPoll={() => poll.mutate(current.runId)} /> : (
          <p className="text-sm text-muted-foreground">Select a run to see its result.</p>
        )}
      </section>
    </div>
  );
}

function RunDetail({ run, polling, onPoll }: { run: TaskRun; polling: boolean; onPoll: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!run.result) return;
    await navigator.clipboard.writeText(run.result.markdown);
    setCopied(true);
    toast.success("Markdown copied");
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="animate-fade">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <StatusDot status={run.status} /> {run.status} · {PRESET_META[run.preset].label} · {run.processor} processor
            {run.notePath ? ` · ${run.notePath}` : ""}
          </p>
          <h2 className="mt-1 text-xl">{run.objective}</h2>
        </div>
        <div className="flex gap-2">
          {ACTIVE.has(run.status) ? (
            <Button variant="outline" size="sm" onClick={onPoll} disabled={polling}>
              {polling ? <Loader2 className="animate-spin" /> : <RefreshCw />} Check now
            </Button>
          ) : null}
          {run.result ? (
            <Button variant="outline" size="sm" onClick={copy}>
              {copied ? <Check /> : <Copy />} Copy markdown
            </Button>
          ) : null}
        </div>
      </div>

      {ACTIVE.has(run.status) ? (
        <div className="mt-6 rounded-lg bg-secondary/60 p-4 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <span className="grade-dot animate-pulse-dot bg-amber" /> Parallel is researching. Usually {run.estimate}. This page checks every few seconds.
          </p>
        </div>
      ) : null}

      {run.status === "failed" ? (
        <div className="mt-6 rounded-lg bg-danger-soft p-4 text-sm">
          <p className="font-medium text-destructive">Run failed</p>
          <p className="mt-1 text-muted-foreground">{run.error ?? "No details were returned."}</p>
        </div>
      ) : null}

      {run.result ? (
        <>
          <Markdown text={run.result.markdown} className="mt-5" />
          {run.result.basis.length ? (
            <details className="mt-6 rounded-lg border border-border p-4">
              <summary className="cursor-pointer text-sm font-medium">Research basis ({run.result.basis.length} fields)</summary>
              <ul className="mt-3 space-y-3 text-sm">
                {run.result.basis.map((b, i) => (
                  <li key={i}>
                    <p className="flex items-center gap-2">
                      <code className="text-xs">{b.field}</code>
                      {b.confidence ? <span className={cn("rounded-full px-2 py-0.5 text-[11px]", confidenceTone(b.confidence))}>{b.confidence}</span> : null}
                    </p>
                    {b.reasoning ? <p className="mt-1 text-xs text-muted-foreground">{b.reasoning}</p> : null}
                    {b.citations.length ? (
                      <ul className="mt-1 space-y-0.5 pl-4 text-xs">
                        {b.citations.map((c) => (
                          <li key={c.url}>
                            <a href={c.url} target="_blank" rel="noreferrer" className="hover:underline">
                              {c.title ?? c.url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function StatusDot({ status }: { status: TaskRun["status"] }) {
  return (
    <span
      className={cn(
        "grade-dot",
        status === "completed" && "bg-grade-green",
        status === "failed" && "bg-grade-red",
        status === "cancelled" && "bg-muted-foreground",
        ACTIVE.has(status) && "animate-pulse-dot bg-amber",
      )}
    />
  );
}

function confidenceTone(c: string): string {
  const v = c.toLowerCase();
  if (v === "high") return "bg-success-soft";
  if (v === "medium") return "bg-warning-soft";
  return "bg-danger-soft";
}
