import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Activity, FlaskConical, KeyRound, Layers } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KeysPanel } from "@/components/dashboard/KeysPanel";
import { UsagePanel } from "@/components/dashboard/UsagePanel";
import { Playground } from "@/components/dashboard/Playground";
import { RunsPanel } from "@/components/dashboard/RunsPanel";
import { useAuth } from "@/hooks/useAuth";

const TABS = ["keys", "usage", "playground", "runs"] as const;
type Tab = (typeof TABS)[number];
const searchSchema = z.object({ tab: z.enum(TABS).optional() });

export const Route = createFileRoute("/_authenticated/dashboard")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Dashboard — Toggle Research" },
      { name: "description", content: "Create plugin keys, watch usage, and run live research from the Toggle Research dashboard." },
      { property: "og:title", content: "Dashboard — Toggle Research" },
      { property: "og:description", content: "Plugin keys, usage and a live research playground for the Notion Toggle plugin." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { user } = useAuth();
  const active: Tab = tab ?? "keys";

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Dashboard</p>
          <h1 className="mt-1 text-3xl sm:text-4xl">Your research desk</h1>
        </div>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
      </div>

      <Tabs value={active} onValueChange={(v) => void navigate({ search: { tab: v as Tab }, replace: true })} className="mt-6">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto bg-secondary/60 p-1">
          <TabsTrigger value="keys" className="gap-1.5">
            <KeyRound className="size-4" /> Keys
          </TabsTrigger>
          <TabsTrigger value="usage" className="gap-1.5">
            <Activity className="size-4" /> Usage
          </TabsTrigger>
          <TabsTrigger value="playground" className="gap-1.5">
            <FlaskConical className="size-4" /> Playground
          </TabsTrigger>
          <TabsTrigger value="runs" className="gap-1.5">
            <Layers className="size-4" /> Deep research
          </TabsTrigger>
        </TabsList>
        <TabsContent value="keys" className="mt-6">
          <KeysPanel />
        </TabsContent>
        <TabsContent value="usage" className="mt-6">
          <UsagePanel />
        </TabsContent>
        <TabsContent value="playground" className="mt-6">
          <Playground />
        </TabsContent>
        <TabsContent value="runs" className="mt-6">
          <RunsPanel />
        </TabsContent>
      </Tabs>
    </main>
  );
}
