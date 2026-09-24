import { gatewayFetch } from "./gateway.server";
import type { PerplexityRequest, PerplexityResult } from "./schemas";

interface PerplexitySearchResponse {
  results?: Array<{ title?: string | null; url: string; snippet?: string | null; date?: string | null }>;
}

/**
 * Perplexity Search API (the only endpoint available on a Lovable-managed
 * connection). Returns ranked web results with snippets — no LLM answer.
 */
export async function perplexitySearch(req: PerplexityRequest): Promise<PerplexityResult[]> {
  const body: Record<string, unknown> = {
    query: req.query,
    max_results: req.maxResults,
    ...(req.recency ? { search_recency_filter: req.recency } : {}),
    ...(req.includeDomains?.length ? { search_domain_filter: req.includeDomains } : {}),
  };
  const { data } = await gatewayFetch<PerplexitySearchResponse>("perplexity", "/search", { body });
  return (data?.results ?? []).map((r) => ({
    title: (r.title ?? "").trim() || safeHost(r.url),
    url: r.url,
    snippet: (r.snippet ?? "").trim(),
    date: r.date ?? null,
  }));
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
