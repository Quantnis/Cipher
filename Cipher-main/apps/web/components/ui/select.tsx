import * as React from "react";
import { cn } from "@/lib/utils";

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 rounded-md border border-zinc-800/80 bg-black/30 px-3 font-mono text-sm text-zinc-100 outline-none transition-colors focus-visible:border-cyan-400/70 focus-visible:ring-2 focus-visible:ring-cyan-400/15",
        className
      )}
      {...props}
    />
  );
}
