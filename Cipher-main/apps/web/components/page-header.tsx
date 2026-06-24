import { Badge } from "@/components/ui/badge";

export function PageHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-4 border-b border-zinc-800/80 pb-5 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant="cyan">Analyst workspace</Badge>
          <Badge variant="outline">ShadowGraph KZ</Badge>
        </div>
        <h1 className="text-2xl font-semibold uppercase tracking-[0.18em] text-white md:text-3xl">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
