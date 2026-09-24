import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpenText, CheckCheck, FileSearch, Globe, Layers, ListChecks, MessageSquareQuote, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader";
import { CodeBlock } from "@/components/site/CodeBlock";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Toggle Research — cited web research inside Obsidian" },
      {
        name: "description",
        content:
          "The research bridge for the Notion Toggle Obsidian plugin. Cited answers, web search, page extraction, fact-checks, recall cards and deep research runs — powered by Parallel and Perplexity, delivered as toggles you remember.",
      },
      { property: "og:title", content: "Toggle Research — cited web research inside Obsidian" },
      {
        property: "og:description",
        content: "Cited answers, search, extraction, fact-checks, recall cards and deep research for the Notion Toggle plugin.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: MessageSquareQuote,
    title: "Cited answers",
    body: "Ask a question from any note. The answer arrives with numbered sources you can keep as a toggle, and follow-ups remember the thread.",
    provider: "Parallel",
  },
  {
    icon: Globe,
    title: "Two search engines",
    body: "Parallel returns quotable excerpts; Perplexity returns ranked, dated results. Filter by domain or recency and insert as a source list.",
    provider: "Parallel · Perplexity",
  },
  {
    icon: FileSearch,
    title: "Extract any page",
    body: "Turn an article or PDF link into clean markdown, focused on what you asked for. Works with JavaScript-rendered pages.",
    provider: "Parallel",
  },
  {
    icon: CheckCheck,
    title: "Fact-check a claim",
    body: "Select a sentence, get a verdict with confidence, a correction when needed and the evidence behind it.",
    provider: "Parallel",
  },
  {
    icon: ListChecks,
    title: "Recall cards",
    body: "Selected text, a link or a topic becomes question → answer toggles, multiple choice or cloze — ready for the plugin's spaced review.",
    provider: "Parallel + Lovable AI",
  },
  {
    icon: Layers,
    title: "Deep research runs",
    body: "Reports, key facts, comparisons, timelines and literature summaries that run for minutes in the background and land in your note with a research basis.",
    provider: "Parallel Task API",
  },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main>
        <section className="mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pt-24">
          <div className="stagger-children">
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground shadow-paper">
              <Sparkles className="size-3.5 text-amber-foreground" /> Research bridge for Notion Toggle v1.7
            </p>
            <h1 className="mt-5 text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
              Research that lands in your notes <span className="italic text-muted-foreground">as toggles you remember.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              One plugin key connects Obsidian to Parallel web research and Perplexity search. Every answer comes with sources; every
              source can become a card the plugin schedules for review.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/auth">
                  Create a plugin key <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/docs">Read the API docs</Link>
              </Button>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <ShieldCheck className="size-4" /> Keys hashed at rest
              </li>
              <li className="flex items-center gap-1.5">
                <BookOpenText className="size-4" /> Open-source plugin
              </li>
              <li className="flex items-center gap-1.5">
                <Globe className="size-4" /> No provider keys in your vault
              </li>
            </ul>
          </div>

          <div className="animate-rise paper-card overflow-hidden" style={{ animationDelay: "200ms" }}>
            <div className="flex items-center gap-2 border-b border-border bg-secondary/60 px-4 py-2 text-xs text-muted-foreground">
              <span className="grade-dot bg-grade-red" />
              <span className="grade-dot bg-grade-yellow" />
              <span className="grade-dot bg-grade-green" />
              <span className="ml-2 font-mono">Research/Spaced repetition.md</span>
            </div>
            <div className="space-y-3 p-5 font-mono text-[0.82rem] leading-relaxed">
              <p className="text-muted-foreground">&gt; [!research] Why does spacing beat massed practice?</p>
              <div className="toggle-preview px-4 py-3">
                <p>▾ Spacing works because each retrieval after partial forgetting strengthens the memory trace more than an immediate repeat.[1][2]</p>
                <p className="mt-2 text-muted-foreground">▸ Sources (2)</p>
                <p className="mt-2 text-muted-foreground">▸ Recall cards (4)</p>
              </div>
              <div className="pl-4">
                <p>▸ What does the "desirable difficulty" hypothesis predict?</p>
                <p>▸ Which interval schedule did Cepeda et al. (2008) find optimal?</p>
              </div>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="grade-dot animate-pulse-dot bg-amber" /> Deep research: "Compare FSRS vs SM-2" · running · ~2 min
              </p>
            </div>
          </div>
        </section>

        <section className="border-y border-border/70 bg-card/60">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-3">
            {[
              ["1", "Create a key", "Sign in, name a key per vault, copy it once. Only a hash is stored here."],
              ["2", "Paste it into the plugin", "Settings → Notion Toggle → Research. Test the connection with one click."],
              ["3", "Research from any note", "Commands, a side panel and right-click actions insert answers, sources and cards as toggles."],
            ].map(([n, title, body]) => (
              <div key={n} className="flex gap-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary font-display text-primary-foreground">{n}</span>
                <div>
                  <h3 className="text-lg">{title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">What the plugin can do</p>
            <h2 className="mt-2 text-3xl sm:text-4xl">Six research moves, one command palette.</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <article key={f.title} className="paper-card flex flex-col p-5 transition-shadow hover:shadow-lift">
                <span className="grid size-10 place-items-center rounded-lg bg-amber-soft text-amber-foreground">
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-xl">{f.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                <p className="mt-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{f.provider}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-20 sm:px-6 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">For builders</p>
            <h2 className="mt-2 text-3xl sm:text-4xl">A small, honest API.</h2>
            <p className="mt-4 text-muted-foreground">
              Nine endpoints, one bearer key, JSON in and out. Search and extraction are cached; deep research returns a run id you poll.
              Everything the plugin does, you can script.
            </p>
            <Button className="mt-6" variant="outline" asChild>
              <Link to="/docs">
                Browse the reference <ArrowRight />
              </Link>
            </Button>
          </div>
          <CodeBlock
            lang="bash"
            code={`curl -s https://<your-bridge>/api/public/research/answer \\
  -H "Authorization: Bearer ntr_…" \\
  -H "Content-Type: application/json" \\
  -d '{"question":"Why does spacing beat cramming?","effort":"low"}'

{ "answer": "Spacing works because…",
  "citations": [{ "url": "https://…", "title": "Cepeda et al. 2008" }],
  "sources":   [ … ], "latencyMs": 8412 }`}
          />
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
