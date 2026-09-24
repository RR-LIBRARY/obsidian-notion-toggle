import { Link, useNavigate } from "@tanstack/react-router";
import { BookOpenText, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { signOut, useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/docs", label: "API docs" },
  { to: "/dashboard", label: "Dashboard" },
] as const;

export function SiteHeader({ className }: { className?: string }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const onSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    setOpen(false);
    void navigate({ to: "/" });
  };

  return (
    <header className={cn("sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur", className)}>
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-paper">
            <BookOpenText className="size-4" />
          </span>
          <span className="font-display text-lg leading-none">
            Toggle <span className="text-muted-foreground">Research</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              activeProps={{ className: "text-foreground bg-accent" }}
            >
              {n.label}
            </Link>
          ))}
          <span className="mx-2 h-5 w-px bg-border" aria-hidden />
          {loading ? (
            <span className="h-8 w-20 animate-pulse rounded-md bg-muted" />
          ) : user ? (
            <Button variant="ghost" size="sm" onClick={onSignOut}>
              <LogOut /> Sign out
            </Button>
          ) : (
            <Button size="sm" asChild>
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </nav>

        <button
          type="button"
          className="grid size-9 place-items-center rounded-md text-foreground hover:bg-accent sm:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-border bg-background px-4 pb-4 pt-2 sm:hidden">
          <div className="flex flex-col gap-1">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent"
              >
                {n.label}
              </Link>
            ))}
            {loading ? null : user ? (
              <Button variant="outline" className="mt-2" onClick={onSignOut}>
                <LogOut /> Sign out
              </Button>
            ) : (
              <Button className="mt-2" asChild>
                <Link to="/auth" onClick={() => setOpen(false)}>
                  Sign in
                </Link>
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          Research bridge for the <span className="text-foreground">Notion Toggle</span> Obsidian plugin.
        </p>
        <div className="flex flex-wrap gap-4">
          <a
            className="hover:text-foreground"
            href="https://github.com/RR-LIBRARY/obsidian-notion-toggle"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          <Link className="hover:text-foreground" to="/docs">
            API docs
          </Link>
          <Link className="hover:text-foreground" to="/dashboard">
            Dashboard
          </Link>
        </div>
      </div>
    </footer>
  );
}
