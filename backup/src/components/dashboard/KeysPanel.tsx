import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { formatDistanceToNow } from "date-fns";
import { Check, Copy, KeyRound, Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { createPluginKey, listPluginKeys, revokePluginKey, type PluginKeySummary } from "@/lib/keys.functions";
import { useOrigin } from "@/hooks/useOrigin";

export function KeysPanel() {
  const qc = useQueryClient();
  const list = useServerFn(listPluginKeys);
  const create = useServerFn(createPluginKey);
  const revoke = useServerFn(revokePluginKey);
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<{ plaintext: string; name: string } | null>(null);

  const keys = useQuery({ queryKey: ["plugin-keys"], queryFn: () => list() });

  const createMut = useMutation({
    mutationFn: (n: string) => create({ data: { name: n } }),
    onSuccess: (res) => {
      setFresh({ plaintext: res.plaintext, name: res.key.name });
      setName("");
      void qc.invalidateQueries({ queryKey: ["plugin-keys"] });
      toast.success(`Key "${res.key.name}" created`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create key"),
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["plugin-keys"] });
      toast.success("Key revoked");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not revoke key"),
  });

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    createMut.mutate(trimmed);
  };

  const bridgeUrl = useOrigin("");
  const active = (keys.data ?? []).filter((k) => !k.revokedAt);
  const revoked = (keys.data ?? []).filter((k) => k.revokedAt);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="space-y-6">
        {fresh ? <FreshKeyCard plaintext={fresh.plaintext} name={fresh.name} bridgeUrl={bridgeUrl} onDone={() => setFresh(null)} /> : null}

        <div className="paper-card p-5">
          <h2 className="text-xl">Active keys</h2>
          <p className="mt-1 text-sm text-muted-foreground">Each Obsidian vault should get its own key so you can revoke one without touching the others.</p>

          <div className="mt-4 divide-y divide-border">
            {keys.isLoading ? (
              <>
                <Skeleton className="my-3 h-12 w-full" />
                <Skeleton className="my-3 h-12 w-full" />
              </>
            ) : keys.isError ? (
              <p className="py-6 text-sm text-destructive">Could not load keys: {(keys.error as Error).message}</p>
            ) : active.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <span className="grid size-10 place-items-center rounded-full bg-amber-soft">
                  <KeyRound className="size-5 text-amber-foreground" />
                </span>
                <p className="font-medium">No keys yet</p>
                <p className="max-w-xs text-sm text-muted-foreground">Create one on the right, paste it into the plugin's Research settings, and you're connected.</p>
              </div>
            ) : (
              active.map((k) => <KeyRow key={k.id} k={k} onRevoke={() => revokeMut.mutate(k.id)} revoking={revokeMut.isPending && revokeMut.variables === k.id} />)
            )}
          </div>
        </div>

        {revoked.length ? (
          <details className="paper-card p-5">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground">Revoked keys ({revoked.length})</summary>
            <div className="mt-3 divide-y divide-border opacity-70">
              {revoked.map((k) => (
                <div key={k.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-medium line-through">{k.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{k.keyPrefix}…</p>
                  </div>
                  <p className="text-xs text-muted-foreground">revoked {formatDistanceToNow(new Date(k.revokedAt!), { addSuffix: true })}</p>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </section>

      <aside className="space-y-6">
        <form onSubmit={onCreate} className="paper-card p-5">
          <h2 className="text-xl">New key</h2>
          <div className="mt-4 space-y-1.5">
            <Label htmlFor="key-name">Label</Label>
            <Input id="key-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Desk vault, iPad, …" maxLength={60} />
          </div>
          <Button type="submit" className="mt-4 w-full" disabled={createMut.isPending || !name.trim()}>
            {createMut.isPending ? <Loader2 className="animate-spin" /> : <Plus />} Create key
          </Button>
          <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
            Only a hash is stored. The full key is shown once, right after creation.
          </p>
        </form>

        <div className="paper-card p-5 text-sm">
          <h3 className="font-medium">Bridge URL</h3>
          <p className="mt-1 text-muted-foreground">Paste this into Settings → Notion Toggle → Research.</p>
          <CopyField value={bridgeUrl} className="mt-3" />
        </div>
      </aside>
    </div>
  );
}

function KeyRow({ k, onRevoke, revoking }: { k: PluginKeySummary; onRevoke: () => void; revoking: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{k.name}</p>
        <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          <span className="font-mono">{k.keyPrefix}…</span>
          <span>{k.requestCount.toLocaleString()} requests</span>
          <span>{k.lastUsedAt ? `used ${formatDistanceToNow(new Date(k.lastUsedAt), { addSuffix: true })}` : "never used"}</span>
        </p>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" disabled={revoking}>
            {revoking ? <Loader2 className="animate-spin" /> : <Trash2 />} Revoke
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke “{k.name}”?</AlertDialogTitle>
            <AlertDialogDescription>Any vault using this key stops working immediately. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={onRevoke} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Revoke key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FreshKeyCard({ plaintext, name, bridgeUrl, onDone }: { plaintext: string; name: string; bridgeUrl: string; onDone: () => void }) {
  return (
    <div className="animate-rise rounded-xl border border-amber/60 bg-amber-soft/60 p-5 shadow-lift">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-amber-foreground">Copy it now</p>
          <h2 className="mt-1 text-xl">“{name}” is ready</h2>
          <p className="mt-1 text-sm text-muted-foreground">This is the only time the full key is shown.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onDone}>
          Done
        </Button>
      </div>
      <CopyField value={plaintext} className="mt-4" mono />
      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-lg bg-card/70 p-3">
          <p className="text-xs text-muted-foreground">Bridge URL</p>
          <p className="truncate font-mono text-xs">{bridgeUrl}</p>
        </div>
        <div className="rounded-lg bg-card/70 p-3">
          <p className="text-xs text-muted-foreground">Where to paste</p>
          <p className="text-xs">Obsidian → Settings → Notion Toggle → Research</p>
        </div>
      </div>
    </div>
  );
}

export function CopyField({ value, className, mono = true }: { value: string; className?: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Clipboard blocked — select and copy manually");
    }
  };
  return (
    <div className={["flex items-center gap-2", className].filter(Boolean).join(" ")}>
      <input
        readOnly
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className={["key-mono min-w-0 flex-1 truncate", mono ? "" : "font-sans"].join(" ")}
        aria-label="Value to copy"
      />
      <Button type="button" variant="outline" size="icon" onClick={copy} aria-label="Copy">
        {copied ? <Check /> : <Copy />}
      </Button>
    </div>
  );
}
