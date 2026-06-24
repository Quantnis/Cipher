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
    <div className="min-h-screen bg-[#030712] text-zinc-100 lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="relative border-r border-zinc-800/80 bg-black/45 backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(34,211,238,0.14),transparent_28%),linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:auto,30px_30px,30px_30px]" />
        <div className="relative z-10 flex h-16 items-center gap-3 border-b border-zinc-800/80 px-4">
          <div className="flex size-10 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-500/10 text-cyan-200 shadow-[0_0_28px_rgba(34,211,238,0.14)]">
            <Shield className="size-5 drop-shadow-[0_0_10px_currentColor]" />
          </div>
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-white">ShadowGraph KZ</div>
            <div className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">B2G cyber intelligence</div>
          </div>
        </div>
        <nav className="relative z-10 flex flex-col gap-1 p-3">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex min-h-11 items-center gap-3 rounded-md border border-transparent px-3 py-2 text-sm text-zinc-500 transition-all duration-200 hover:border-cyan-400/20 hover:bg-cyan-500/10 hover:text-cyan-100",
                  active && "border-cyan-400/30 bg-cyan-500/10 text-zinc-100 shadow-[0_0_28px_rgba(34,211,238,0.1)]"
                )}
              >
                <Icon className={cn("size-4", active ? "text-cyan-200 drop-shadow-[0_0_8px_currentColor]" : "text-zinc-600 group-hover:text-cyan-200")} />
                <span className="truncate font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="relative z-10 mx-3 mt-3 rounded-lg border border-zinc-800/70 bg-zinc-900/40 p-3 backdrop-blur-md">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-600">System mode</span>
            <Badge variant="success">Live</Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Circle className="size-2 fill-emerald-400 text-emerald-400 drop-shadow-[0_0_8px_currentColor]" />
            Real configured sources only
          </div>
        </div>
        <div className="relative z-10 m-3 rounded-lg border border-zinc-800/70 bg-zinc-900/40 p-3 backdrop-blur-md">
          <div className="mb-2 flex items-center gap-2">
            <ScrollText className="size-4 text-cyan-200" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-600">Legal boundary</span>
          </div>
          <p className="text-xs leading-5 text-zinc-500">Authorized analysis of configured public and legally accessible sources only. Automated indicators require human verification.</p>
        </div>
      </aside>
      <main className="relative min-w-0 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(34,211,238,0.14),transparent_28%),radial-gradient(circle_at_82%_0%,rgba(99,102,241,0.14),transparent_26%),linear-gradient(180deg,#030712_0%,#050816_54%,#020617_100%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(148,163,184,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.04)_1px,transparent_1px)] [background-size:36px_36px]" />
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-zinc-800/80 bg-[#030712]/82 px-4 backdrop-blur-xl lg:px-6">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-100">Authorized public-source risk intelligence</div>
            <div className="font-mono text-xs text-zinc-500">Provenance, redaction, graph context, and analyst review</div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Real-data mode</Badge>
            <Button variant="outline" size="sm">
              <Gauge data-icon="inline-start" />
              Risk weights
            </Button>
          </div>
        </header>
        <div className="relative z-10 p-4 lg:p-5">{children}</div>
      </main>
    </div>
  );
}


