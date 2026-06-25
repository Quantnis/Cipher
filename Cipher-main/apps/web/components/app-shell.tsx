"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Archive, Bot, Circle, Crosshair, FileText, Gauge, GitBranch, LayoutDashboard, LockKeyhole, Map, ScrollText, Settings, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/neon-button";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/crawler", label: "Sources", icon: Bot },
  { href: "/osint", label: "OSINT Intelligence", icon: Crosshair },
  { href: "/threats", label: "Live Monitoring", icon: Activity },
  { href: "/graph", label: "Graph Intelligence", icon: GitBranch },
  { href: "/map", label: "Kazakhstan Map", icon: Map },
  { href: "/cases", label: "Cases", icon: Archive },
  { href: "/evidence", label: "Evidence Vault", icon: LockKeyhole },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/admin", label: "Admin", icon: Settings }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#09090b] text-zinc-100">
      <aside className="flex h-full w-64 flex-shrink-0 flex-col justify-between border-r border-zinc-800 bg-zinc-950/50 p-4">
        <div className="min-h-0">
          <div className="mb-5 flex h-11 items-center gap-3">
            <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/70 text-zinc-200">
              <Shield className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate font-sans text-sm font-bold uppercase tracking-[0.14em] text-zinc-100">ShadowGraph KZ</div>
              <div className="font-mono text-xs uppercase tracking-normal text-zinc-500">B2G cyber intelligence</div>
            </div>
          </div>

          <nav className="flex min-h-0 flex-col gap-1 overflow-hidden">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex h-10 flex-shrink-0 items-center gap-3 rounded-lg border border-transparent px-3 text-sm text-zinc-500 transition-colors hover:border-zinc-800/80 hover:bg-zinc-900/35 hover:text-zinc-100",
                    active && "border-zinc-700/80 bg-zinc-900/65 text-zinc-100"
                  )}
                >
                  <Icon className={cn("size-4", active ? "text-zinc-100" : "text-zinc-600 group-hover:text-zinc-300")} />
                  <span className="truncate font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="grid flex-shrink-0 gap-3">
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/20 p-4 backdrop-blur-md">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="font-mono text-xs uppercase tracking-normal text-zinc-500">System mode</span>
              <Badge variant="success" className="rounded-md font-mono text-xs font-bold uppercase tracking-wider">Live</Badge>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs text-zinc-500">
              <Circle className="size-2 fill-emerald-500 text-emerald-500" />
              Real configured sources only
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/20 p-4 backdrop-blur-md">
            <div className="mb-2 flex items-center gap-2">
              <ScrollText className="size-4 text-zinc-400" />
              <span className="font-mono text-xs uppercase tracking-normal text-zinc-500">Legal boundary</span>
            </div>
            <p className="line-clamp-3 text-xs leading-5 text-zinc-500">Authorized analysis of configured public and legally accessible sources only. Automated indicators require human verification.</p>
          </div>
        </div>
      </aside>

      <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-[#09090b]">
        <header className="flex h-14 w-full flex-shrink-0 items-center justify-between border-b border-zinc-800/80 bg-zinc-950/20 px-6 backdrop-blur-xl">
          <div className="min-w-0">
            <div className="truncate font-sans text-sm font-bold uppercase tracking-[0.14em] text-zinc-100">Authorized public-source risk intelligence</div>
            <div className="font-mono text-xs tracking-normal text-zinc-500">Provenance, redaction, graph context, and analyst review</div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden rounded-md border-zinc-800 bg-zinc-900/35 font-mono text-xs text-zinc-400 sm:inline-flex">Real-data mode</Badge>
            <Button variant="outline" size="sm" neon={false}>
              <Gauge data-icon="inline-start" />
              Risk weights
            </Button>
          </div>
        </header>
        <div className="flex min-h-0 w-full flex-1 flex-col gap-6 overflow-hidden p-6">{children}</div>
      </main>
    </div>
  );
}