import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function CodeBlock({
  code,
  label,
  lang,
  className,
}: {
  code: string;
  label?: string;
  lang?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-sidebar", className)}>
      <div className="flex items-center justify-between border-b border-border/70 px-3 py-1.5 text-xs text-muted-foreground">
        <span>{label ?? lang ?? "code"}</span>
        <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-accent hover:text-foreground">
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[0.78rem] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}
