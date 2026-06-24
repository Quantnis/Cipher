import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-zinc-800/60 bg-zinc-900/40 text-card-foreground shadow-[0_24px_90px_rgba(0,0,0,0.34)] backdrop-blur-md",
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.075),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.05),transparent_22%)]",
        "after:pointer-events-none after:absolute after:inset-0 after:bg-[linear-gradient(rgba(255,255,255,0.022)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.016)_1px,transparent_1px)] after:bg-[size:28px_28px] after:opacity-35",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("relative z-10 flex flex-col gap-1.5 border-b border-zinc-800/70 px-5 py-4", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-semibold uppercase tracking-[0.16em] text-zinc-100", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs leading-5 text-zinc-500", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("relative z-10 p-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("relative z-10 flex items-center border-t border-zinc-800/70 px-5 py-4", className)} {...props} />;
}
