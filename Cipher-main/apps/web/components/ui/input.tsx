import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "h-10 w-full rounded-md border border-slate-border bg-slate-base/30 px-3 font-mono text-sm text-ink-primary outline-none transition-colors placeholder:text-ink-muted focus-visible:border-signal-info/70 focus-visible:ring-2 focus-visible:ring-signal-info/15",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";
