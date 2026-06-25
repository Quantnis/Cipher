import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] shadow-[0_0_18px_rgba(0,0,0,0.16)]", {
  variants: {
    variant: {
      default: "border-signal-info/30 bg-signal-info/10 text-signal-accent",
      secondary: "border-slate-border bg-slate-card/70 text-ink-secondary",
      outline: "border-slate-border bg-slate-base/30 text-ink-secondary",
      destructive: "border-signal-critical/50 bg-signal-critical/10 text-signal-critical",
      success: "border-signal-safe/35 bg-signal-safe/10 text-signal-safe",
      warning: "border-signal-warning/45 bg-signal-warning/10 text-signal-warning",
      cyan: "border-signal-info/35 bg-signal-info/10 text-signal-accent"
    }
  },
  defaultVariants: { variant: "default" }
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, className }))} {...props} />;
}
