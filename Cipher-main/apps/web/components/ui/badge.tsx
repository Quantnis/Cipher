import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] shadow-[0_0_18px_rgba(0,0,0,0.16)]", {
  variants: {
    variant: {
      default: "border-cyan-400/30 bg-cyan-500/10 text-cyan-100",
      secondary: "border-zinc-700/80 bg-zinc-900/70 text-zinc-300",
      outline: "border-zinc-700/80 bg-black/30 text-zinc-400",
      destructive: "border-rose-400/50 bg-rose-500/10 text-rose-100 shadow-[0_0_24px_rgba(244,63,94,0.18)]",
      success: "border-emerald-400/35 bg-emerald-500/10 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.12)]",
      warning: "border-orange-400/45 bg-orange-500/10 text-orange-100 shadow-[0_0_20px_rgba(249,115,22,0.14)]",
      cyan: "border-cyan-400/35 bg-cyan-500/10 text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.12)]"
    }
  },
  defaultVariants: { variant: "default" }
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, className }))} {...props} />;
}
