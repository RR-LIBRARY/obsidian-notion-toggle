import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader";
import { CodeBlock } from "@/components/site/CodeBlock";
import { useOrigin } from "@/hooks/useOrigin";
import { renderInline } from "@/components/Markdown";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Bridge API docs — Toggle Research" },
      {
        name: "description",
        content:
          "REST reference for the Toggle Research bridge: web search, extraction, cited answers, fact-checks, recall cards and deep research runs for the Notion Toggle Obsidian plugin.",
      },
      { property: "og:title", content: "Bridge API docs — Toggle Research" },
      { property: "og:description", content: "Search, extract, cited answers, fact-checks, recall cards and deep research over one plugin key." },
    ],
  }),
  component: DocsPage,
});

const ENDPOINTS: Array<{
  method: "GET" | "POST";
  path: string;
  title: string;
  provider: string;
  summary: string;
  request?: string;
  response: string;
}> = [
  {
    method: "GET",
    path: "/api/public/research/health",
    title: "Health",
    provider: "—",
    summary: "Provider availability. Send a key to confirm the pairing (returns the key name).",
    response: `{ "ok": true, "version": "1.0.0",
  "providers": { "parallel": true, "perplexity": true, "ai": true },
  "key": { "name": "Desk vault", "prefix": "ntr_ab12" } }`,
  },
  {
    method: "POST",
    path: "/api/public/research/search",
    title: "Web search",
    provider: "Parallel",
    summary: "LLM-ready excerpts from the open web. `mode` trades latency for depth: turbo · fast · basic · advanced.",
    request: `{ "query": "FSRS algorithm vs SM-2 retention",
  "mode": "fast", "maxResults": 6,
  "afterDate": "2024-01-01",
  "includeDomains": ["arxiv.org", "github.com"] }`,
    response: `{ "results": [{ "url": "…", "title": "…", "publishDate": "2024-06-01",
                "excerpts": ["…"] }],
  "warnings": [], "cached": false, "latencyMs": 812 }`,
  },
  {
    method: "POST",
    path: "/api/public/research/perplexity",
    title: "Perplexity search",
    provider: "Perplexity",
    summary: "Ranked web results with snippets. Supports recency filters (day · week · month · year).",
    request: `{ "query": "latest Obsidian plugin API changes", "maxResults": 5, "recency": "month" }`,
    response: `{ "results": [{ "title": "…", "url": "…", "snippet": "…", "date": "2026-03-02" }],
  "cached": false, "latencyMs": 640 }`,
  },
  {
    method: "POST",
    path: "/api/public/research/extract",
    title: "Extract",
    provider: "Parallel",
    summary: "Clean markdown from up to 20 public URLs or PDFs. Pass an objective to get focused excerpts instead of the full page.",
    request: `{ "urls": ["https://arxiv.org/abs/2402.12345"],
  "objective": "method and headline result", "fullContent": false }`,
    response: `{ "results": [{ "url": "…", "title": "…", "excerpts": ["…"], "fullContent": null }],
  "errors": [], "cached": false, "latencyMs": 1420 }`,
  },
  {
    method: "POST",
    path: "/api/public/research/answer",
    title: "Cited answer",
    provider: "Parallel",
    summary: "A researched answer with inline citations. Pass `previousResponseId` to keep a conversation going.",
    request: `{ "question": "Why does spacing improve retention?",
  "effort": "medium", "previousResponseId": null }`,
    response: `{ "responseId": "resp_…", "answer": "…",
  "citations": [{ "url": "…", "title": "…", "startIndex": 12, "endIndex": 80 }],
  "sources": [{ "url": "…", "title": "…" }], "searches": ["…"], "latencyMs": 9800 }`,
  },
  {
    method: "POST",
    path: "/api/public/research/factcheck",
    title: "Fact-check",
    provider: "Parallel",
    summary: "Verdict (supported · refuted · mixed · unverifiable) with confidence, rationale and sources.",
    request: `{ "claim": "Ebbinghaus published the forgetting curve in 1885." }`,
    response: `{ "verdict": "supported", "confidence": 0.93, "summary": "…",
  "evidence": [{ "point": "…", "stance": "supports", "url": "…" }], "sources": [ … ] }`,
  },
  {
    method: "POST",
    path: "/api/public/research/recall",
    title: "Recall cards",
    provider: "Parallel + Lovable AI",
    summary: "Turn selected text, a URL or a topic into toggle-ready cards (basic Q/A or multiple choice).",
    request: `{ "text": "…selected note text…", "count": 6, "style": "basic", "difficulty": "mixed" }`,
    response: `{ "cards": [{ "question": "…", "answer": "…", "hint": null,
              "options": null, "correctIndex": null }],
  "sources": [ … ], "topic": "…" }`,
  },
  {
    method: "POST",
    path: "/api/public/research/tasks",
    title: "Deep research — start",
    provider: "Parallel Task API",
    summary: "Starts an asynchronous run and returns immediately. Presets: report · key_facts · compare · timeline · literature.",
    request: `{ "objective": "Compare FSRS, SM-2 and Leitner for language learners",
  "preset": "compare", "processor": "base", "notePath": "Research/SRS.md" }`,
    response: `{ "runId": "trun_…", "status": "queued", "estimate": "15 s – 2 min", … }`,
  },
  {
    method: "GET",
    path: "/api/public/research/tasks/{runId}",
    title: "Deep research — poll",
    provider: "Parallel Task API",
    summary: "Returns at once. When complete, `result.markdown` is ready to insert and `result.basis` carries per-field confidence and citations.",
    response: `{ "runId": "trun_…", "status": "completed",
  "result": { "markdown": "…", "basis": [{ "field": "…", "confidence": "high", "citations": [ … ] }],
              "sources": [ … ] } }`,
  },
];

function DocsPage() {
  const origin = useOrigin();
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Bridge API</p>
          <h1 className="mt-2 text-4xl sm:text-5xl">One key. Nine research calls.</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            The plugin never talks to a provider directly. It calls this bridge with a plugin key; the bridge holds the Parallel
            and Perplexity credentials, caches repeat lookups and logs usage to your dashboard.
          </p>
        </div>

        <section className="mt-12 grid gap-6 lg:grid-cols-[240px_1fr]">
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <nav className="paper-card p-4 text-sm">
              <p className="mb-2 font-medium">On this page</p>
              <ul className="space-y-1.5 text-muted-foreground">
                <li>
                  <a className="hover:text-foreground" href="#auth">
                    Authentication
                  </a>
                </li>
                <li>
                  <a className="hover:text-foreground" href="#errors">
                    Errors &amp; limits
                  </a>
                </li>
                {ENDPOINTS.map((e) => (
                  <li key={e.path}>
                    <a className="hover:text-foreground" href={`#${anchor(e.path)}`}>
                      {e.title}
                    </a>
                  </li>
                ))}
                <li>
                  <a className="hover:text-foreground" href="#plugin">
                    Plugin setup
                  </a>
                </li>
              </ul>
            </nav>
          </aside>

          <div className="space-y-10">
            <article id="auth" className="scroll-mt-24">
              <h2 className="text-2xl">Authentication</h2>
              <p className="mt-2 text-muted-foreground">
                Create a key in the <Link className="underline decoration-amber underline-offset-4" to="/dashboard">dashboard</Link>. Keys look like{" "}
                <code>ntr_…</code> and are shown once; only a hash is stored. Send it on every call:
              </p>
              <CodeBlock
                className="mt-4"
                lang="http"
                code={`Authorization: Bearer ntr_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json`}
              />
              <CodeBlock
                className="mt-3"
                lang="bash"
                code={`curl -s ${origin}/api/public/research/search \\
  -H "Authorization: Bearer $NTR_KEY" -H "Content-Type: application/json" \\
  -d '{"query":"spaced repetition retention curve","mode":"fast","maxResults":5}'`}
              />
            </article>

            <article id="errors" className="scroll-mt-24">
              <h2 className="text-2xl">Errors &amp; limits</h2>
              <p className="mt-2 text-muted-foreground">
                Every failure is JSON with a stable <code>code</code>. The plugin shows <code>message</code> verbatim.
              </p>
              <CodeBlock
                className="mt-4"
                lang="json"
                code={`{ "error": { "code": "rate_limited", "message": "Parallel is rate limiting requests. Try again in 12 s.",
             "status": 429, "retryAfterSec": 12 } }`}
              />
              <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                {[
                  ["invalid_request", "400 — schema validation failed; details in message"],
                  ["unauthorized", "401 — missing, revoked or unknown key"],
                  ["not_found", "404 — run id not owned by this key"],
                  ["rate_limited", "429 — provider throttled; honour retryAfterSec"],
                  ["provider_error", "502/504 — upstream failed or timed out"],
                  ["payment_required", "402 — workspace credits ran out"],
                ].map(([code, desc]) => (
                  <li key={code} className="paper-card px-3 py-2">
                    <code className="text-xs">{code}</code>
                    <p className="mt-0.5 text-muted-foreground">{desc}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-muted-foreground">
                Search, Perplexity and extract responses are cached for 15 minutes per key owner (<code>cached: true</code>). Deep
                research is capped at 10 active runs per account.
              </p>
            </article>

            {ENDPOINTS.map((e) => (
              <article key={e.path} id={anchor(e.path)} className="scroll-mt-24">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={
                      e.method === "GET"
                        ? "rounded-md bg-success-soft px-2 py-0.5 font-mono text-xs font-medium"
                        : "rounded-md bg-amber-soft px-2 py-0.5 font-mono text-xs font-medium"
                    }
                  >
                    {e.method}
                  </span>
                  <code className="text-sm">{e.path}</code>
                  <span className="ml-auto text-xs text-muted-foreground">{e.provider}</span>
                </div>
                <h2 className="mt-2 text-2xl">{e.title}</h2>
                <p className="mt-1 text-muted-foreground">{renderInline(e.summary)}</p>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {e.request ? <CodeBlock label="Request" lang="json" code={e.request} /> : <div className="hidden lg:block" />}
                  <CodeBlock label="Response" lang="json" code={e.response} />
                </div>
              </article>
            ))}

            <article id="plugin" className="scroll-mt-24">
              <h2 className="text-2xl">Plugin setup</h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted-foreground">
                <li>Install Notion Toggle in Obsidian (Community plugins or BRAT).</li>
                <li>
                  Open <span className="text-foreground">Settings → Notion Toggle → Research</span>.
                </li>
                <li>Paste the bridge URL shown in your dashboard and the plugin key.</li>
                <li>
                  Press <span className="text-foreground">Test connection</span>. Then try{" "}
                  <span className="text-foreground">Research: Ask a cited question</span> from the command palette.
                </li>
              </ol>
            </article>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function anchor(path: string): string {
  return path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}
