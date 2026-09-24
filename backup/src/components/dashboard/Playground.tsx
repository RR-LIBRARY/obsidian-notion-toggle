import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/Markdown";
import {
  playgroundAnswer,
  playgroundCreateTask,
  playgroundExtract,
  playgroundFactCheck,
  playgroundPerplexity,
  playgroundRecall,
  playgroundSearch,
} from "@/lib/playground.functions";
import {
  PRESET_META,
  type AnswerResponse,
  type ExtractResponse,
  type FactCheckResponse,
  type PerplexityResponse,
  type RecallResponse,
  type SearchResponse,
  type TaskPreset,
} from "@/lib/research/schemas";
import { cn } from "@/lib/utils";

type Op = "answer" | "search" | "perplexity" | "extract" | "factcheck" | "recall" | "task";

const OPS: Array<{ id: Op; label: string; hint: string; placeholder: string; provider: string }> = [
  { id: "answer", label: "Cited answer", hint: "Ask anything; get an answer with inline sources.", placeholder: "Why does spaced repetition beat cramming?", provider: "Parallel" },
  { id: "search", label: "Web search", hint: "Excerpts from the open web, ready to quote.", placeholder: "FSRS algorithm retention study", provider: "Parallel" },
  { id: "perplexity", label: "Perplexity", hint: "Ranked results with snippets and dates.", placeholder: "Obsidian 1.8 plugin API changes", provider: "Perplexity" },
  { id: "extract", label: "Extract", hint: "Paste one URL per line (articles, PDFs).", placeholder: "https://arxiv.org/abs/2402.12345", provider: "Parallel" },
  { id: "factcheck", label: "Fact-check", hint: "One claim; get a verdict and evidence.", placeholder: "Ebbinghaus published the forgetting curve in 1885.", provider: "Parallel" },
  { id: "recall", label: "Recall cards", hint: "Paste text or a topic; get toggle-ready cards.", placeholder: "The Krebs cycle…", provider: "Parallel + AI" },
  { id: "task", label: "Deep research", hint: "Runs in the background for minutes; see the Deep research tab.", placeholder: "Compare FSRS, SM-2 and Leitner for language learners", provider: "Parallel Task API" },
];

type Result =
  | { op: "answer"; data: AnswerResponse }
  | { op: "search"; data: SearchResponse }
  | { op: "perplexity"; data: PerplexityResponse }
  | { op: "extract"; data: ExtractResponse }
  | { op: "factcheck"; data: FactCheckResponse }
  | { op: "recall"; data: RecallResponse }
  | { op: "task"; runId: string; estimate: string };

export function Playground() {
  const qc = useQueryClient();
  const fns = {
    answer: useServerFn(playgroundAnswer),
    search: useServerFn(playgroundSearch),
    perplexity: useServerFn(playgroundPerplexity),
    extract: useServerFn(playgroundExtract),
    factcheck: useServerFn(playgroundFactCheck),
    recall: useServerFn(playgroundRecall),
    task: useServerFn(playgroundCreateTask),
  };
  const [op, setOp] = useState<Op>("answer");
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"turbo" | "fast" | "basic" | "advanced">("fast");
  const [effort, setEffort] = useState<"low" | "medium" | "high">("low");
  const [preset, setPreset] = useState<TaskPreset>("report");
  const [recallStyle, setRecallStyle] = useState<"qa" | "mcq" | "cloze">("qa");
  const [domains, setDomains] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [previousResponseId, setPreviousResponseId] = useState<string | undefined>(undefined);

  const current = OPS.find((o) => o.id === op)!;
  const domainList = domains
    .split(/[\s,]+/)
    .map((d) => d.trim())
    .filter(Boolean);

  const run = useMutation({
    mutationFn: async (): Promise<Result> => {
      const q = input.trim();
      if (!q) throw new Error("Type something first");
      const includeDomains = domainList.length ? domainList : undefined;
      switch (op) {
        case "answer":
          return { op, data: await fns.answer({ data: { question: q, effort, ...(previousResponseId ? { previousResponseId } : {}), ...(includeDomains ? { includeDomains } : {}) } }) };
        case "search":
          return { op, data: await fns.search({ data: { query: q, mode, maxResults: 8, maxChars: 1500, ...(includeDomains ? { includeDomains } : {}) } }) };
        case "perplexity":
          return { op, data: await fns.perplexity({ data: { query: q, maxResults: 8, ...(includeDomains ? { includeDomains } : {}) } }) };
        case "extract": {
          const urls = q.split(/\s+/).filter(Boolean);
          return { op, data: await fns.extract({ data: { urls, fullContent: false, maxChars: 6000 } }) };
        }
        case "factcheck":
          return { op, data: await fns.factcheck({ data: { claim: q, effort } }) };
        case "recall": {
          const isUrl = /^https?:\/\/\S+$/.test(q);
          const body = isUrl ? { url: q } : q.length > 200 ? { text: q } : { topic: q };
          return { op, data: await fns.recall({ data: { ...body, count: 8, style: recallStyle, difficulty: "mixed" } }) };
        }
        case "task": {
          const run = await fns.task({ data: { objective: q, preset } });
          return { op, runId: run.runId, estimate: run.estimate };
        }
      }
    },
    onSuccess: (r) => {
      setResult(r);
      if (r.op === "answer") setPreviousResponseId(r.data.responseId);
      if (r.op === "task") {
        void qc.invalidateQueries({ queryKey: ["research-runs"] });
        toast.success("Deep research started", { description: `Usually ${r.estimate}. Track it in the Deep research tab.` });
      }
      void qc.invalidateQueries({ queryKey: ["usage-summary"] });
      void qc.invalidateQueries({ queryKey: ["usage-recent"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Request failed"),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!run.isPending) run.mutate();
  };

  const changeOp = (next: Op) => {
    setOp(next);
    setResult(null);
    setPreviousResponseId(undefined);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <aside className="paper-card h-fit p-2">
        {OPS.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => changeOp(o.id)}
            className={cn(
              "flex w-full flex-col items-start rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent",
              op === o.id && "bg-accent",
            )}
          >
            <span className="flex w-full items-center justify-between text-sm font-medium">
              {o.label}
              <span className="text-[10px] font-normal uppercase tracking-wide text-muted-foreground">{o.provider}</span>
            </span>
            <span className="mt-0.5 text-xs text-muted-foreground">{o.hint}</span>
          </button>
        ))}
      </aside>

      <section className="space-y-5">
        <form onSubmit={onSubmit} className="paper-card space-y-4 p-5">
          <div>
            <h2 className="text-xl">{current.label}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{current.hint}</p>
          </div>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={current.placeholder}
            rows={op === "recall" || op === "extract" ? 5 : 3}
            className="resize-y"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onSubmit(e);
            }}
          />

          <div className="grid gap-3 sm:grid-cols-3">
            {op === "search" ? (
              <Field label="Mode">
                <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="turbo">Turbo · fastest</SelectItem>
                    <SelectItem value="fast">Fast · under a second</SelectItem>
                    <SelectItem value="basic">Basic · richer excerpts</SelectItem>
                    <SelectItem value="advanced">Advanced · deepest</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            {op === "answer" || op === "factcheck" ? (
              <Field label="Effort">
                <Select value={effort} onValueChange={(v) => setEffort(v as typeof effort)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low · quick lookup</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High · deep dive</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            {op === "recall" ? (
              <Field label="Card style">
                <Select value={recallStyle} onValueChange={(v) => setRecallStyle(v as typeof recallStyle)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="qa">Question → answer</SelectItem>
                    <SelectItem value="mcq">Multiple choice</SelectItem>
                    <SelectItem value="cloze">Cloze (fill the blank)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            {op === "task" ? (
              <Field label="Preset" className="sm:col-span-2">
                <Select value={preset} onValueChange={(v) => setPreset(v as TaskPreset)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PRESET_META) as TaskPreset[]).map((p) => (
                      <SelectItem key={p} value={p}>
                        {PRESET_META[p].label} — {PRESET_META[p].description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            {op === "answer" || op === "search" || op === "perplexity" ? (
              <Field label="Only these domains (optional)">
                <Input value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="arxiv.org, nature.com" />
              </Field>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={run.isPending || !input.trim()}>
              {run.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {op === "task" ? "Start run" : "Run"}
            </Button>
            {op === "answer" && previousResponseId ? (
              <button type="button" className="text-xs text-muted-foreground underline underline-offset-4" onClick={() => setPreviousResponseId(undefined)}>
                Follow-up mode on — start a fresh thread
              </button>
            ) : (
              <span className="text-xs text-muted-foreground">⌘/Ctrl + Enter to run</span>
            )}
          </div>
        </form>

        {run.isPending ? (
          <div className="paper-card flex items-center gap-3 p-5 text-sm text-muted-foreground">
            <span className="grade-dot animate-pulse-dot bg-amber" />
            {op === "answer" || op === "factcheck" ? "Reading sources and writing…" : op === "recall" ? "Researching and drafting cards…" : "Working…"}
          </div>
        ) : result ? (
          <ResultView result={result} onFollowUp={(q) => setInput(q)} />
        ) : null}
      </section>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ResultView({ result, onFollowUp }: { result: Result; onFollowUp: (q: string) => void }) {
  switch (result.op) {
    case "task":
      return (
        <div className="paper-card p-5 text-sm">
          <p className="font-medium">Run started</p>
          <p className="mt-1 text-muted-foreground">
            Run id <code className="text-xs">{result.runId}</code>. Usually finishes in {result.estimate}. Open the Deep research tab to watch it.
          </p>
        </div>
      );
    case "answer": {
      const d = result.data;
      return (
        <div className="paper-card animate-fade p-5">
          <Meta latencyMs={d.latencyMs} cached={false} extra={d.searches.length ? `${d.searches.length} searches` : undefined} />
          <Markdown text={d.answer} className="mt-3" />
          <SourceList sources={d.sources} />
          <div className="mt-4 flex flex-wrap gap-2">
            {["Give me a concrete example", "What's the strongest counter-argument?", "Summarise in 3 bullets"].map((q) => (
              <button key={q} type="button" onClick={() => onFollowUp(q)} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs hover:bg-accent">
                {q} <ArrowRight className="size-3" />
              </button>
            ))}
          </div>
        </div>
      );
    }
    case "factcheck": {
      const d = result.data;
      const tone =
        d.verdict === "supported" ? "bg-success-soft" : d.verdict === "contradicted" ? "bg-danger-soft" : d.verdict === "partially_supported" ? "bg-warning-soft" : "bg-muted";
      return (
        <div className="paper-card animate-fade p-5">
          <Meta latencyMs={d.latencyMs} cached={false} />
          <div className={cn("mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium", tone)}>
            {d.verdict.replace("_", " ")} · {d.confidence} confidence
          </div>
          <p className="mt-3 text-[0.95rem] leading-relaxed">{d.summary}</p>
          {d.correction ? (
            <p className="mt-3 rounded-lg bg-amber-soft px-3 py-2 text-sm">
              <span className="font-medium">Correction: </span>
              {d.correction}
            </p>
          ) : null}
          <SourceList sources={d.sources} quotes />
        </div>
      );
    }
    case "search": {
      const d = result.data;
      return (
        <div className="paper-card animate-fade p-5">
          <Meta latencyMs={d.latencyMs} cached={d.cached} extra={`${d.results.length} results`} />
          {d.warnings?.length ? <p className="mt-2 text-xs text-warning">{d.warnings.join(" · ")}</p> : null}
          <ul className="mt-3 divide-y divide-border">
            {d.results.map((r) => (
              <li key={r.url} className="py-3">
                <a href={r.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                  {r.title}
                </a>
                <p className="text-xs text-muted-foreground">
                  {hostname(r.url)}
                  {r.publishDate ? ` · ${r.publishDate.slice(0, 10)}` : ""}
                </p>
                {r.excerpts[0] ? <p className="mt-1.5 line-clamp-4 text-sm leading-relaxed text-foreground/90">{r.excerpts[0]}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case "perplexity": {
      const d = result.data;
      return (
        <div className="paper-card animate-fade p-5">
          <Meta latencyMs={d.latencyMs} cached={d.cached} extra={`${d.results.length} results`} />
          <ul className="mt-3 divide-y divide-border">
            {d.results.map((r) => (
              <li key={r.url} className="py-3">
                <a href={r.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                  {r.title}
                </a>
                <p className="text-xs text-muted-foreground">
                  {hostname(r.url)}
                  {r.date ? ` · ${r.date}` : ""}
                </p>
                <p className="mt-1.5 line-clamp-5 text-sm leading-relaxed text-foreground/90">{r.snippet}</p>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case "extract": {
      const d = result.data;
      return (
        <div className="paper-card animate-fade p-5">
          <Meta latencyMs={d.latencyMs} cached={false} extra={`${d.results.length} pages`} />
          {d.errors.length ? (
            <ul className="mt-2 text-xs text-destructive">
              {d.errors.map((e) => (
                <li key={e.url}>
                  {e.url} — {e.errorType}
                  {e.httpStatus ? ` (${e.httpStatus})` : ""}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-3 space-y-5">
            {d.results.map((r) => (
              <article key={r.url}>
                <a href={r.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                  {r.title}
                </a>
                <p className="text-xs text-muted-foreground">{hostname(r.url)}</p>
                <Markdown text={r.fullContent ?? r.excerpts.join("\n\n")} className="mt-2 max-h-96 overflow-y-auto rounded-lg bg-secondary/50 p-3" />
              </article>
            ))}
          </div>
        </div>
      );
    }
    case "recall": {
      const d = result.data;
      return (
        <div className="paper-card animate-fade p-5">
          <Meta latencyMs={d.latencyMs} cached={false} extra={`${d.cards.length} cards · ${d.title}`} />
          <ol className="mt-3 space-y-2">
            {d.cards.map((c, i) => (
              <li key={i} className="toggle-preview px-4 py-3">
                <p className="font-medium">
                  <span className="mr-2 text-muted-foreground">▸</span>
                  {c.question}
                </p>
                {c.options?.length ? (
                  <ul className="mt-2 space-y-1 pl-6 text-sm">
                    {c.options.map((o, oi) => (
                      <li key={oi} className={cn(oi === c.correctIndex && "font-medium text-success")}>
                        {String.fromCharCode(65 + oi)}. {o}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 pl-6 text-sm text-muted-foreground">{c.answer}</p>
                )}
                {c.hint ? <p className="mt-1 pl-6 text-xs text-muted-foreground">Hint: {c.hint}</p> : null}
              </li>
            ))}
          </ol>
          <SourceList sources={d.sources} />
        </div>
      );
    }
  }
}

function Meta({ latencyMs, cached, extra }: { latencyMs: number; cached: boolean; extra?: string | undefined }) {
  return (
    <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
      <span>{(latencyMs / 1000).toFixed(1)} s</span>
      {cached ? <span className="rounded-full bg-accent px-2">cached</span> : null}
      {extra ? <span>{extra}</span> : null}
    </p>
  );
}

function SourceList({ sources, quotes = false }: { sources: Array<{ url: string; title: string; quote?: string | null }>; quotes?: boolean }) {
  if (!sources.length) return null;
  return (
    <div className="mt-4 border-t border-border pt-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sources</p>
      <ol className="mt-2 space-y-1.5 text-sm">
        {sources.map((s, i) => (
          <li key={s.url} className="flex gap-2">
            <span className="w-5 shrink-0 text-muted-foreground">{i + 1}.</span>
            <div className="min-w-0">
              <a href={s.url} target="_blank" rel="noreferrer" className="hover:underline">
                {s.title}
              </a>
              <span className="ml-2 text-xs text-muted-foreground">{hostname(s.url)}</span>
              {quotes && s.quote ? <p className="mt-0.5 text-xs italic text-muted-foreground">“{s.quote}”</p> : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
