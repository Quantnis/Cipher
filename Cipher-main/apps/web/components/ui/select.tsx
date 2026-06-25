import * as React from "react";
import { cn } from "@/lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, children, ...props }, ref) => {
  return (
    <select
      ref={ref}
      className={cn(
        "h-10 rounded-md border border-slate-border bg-slate-base/30 px-3 font-mono text-sm text-ink-primary outline-none transition-colors focus-visible:border-signal-info/70 focus-visible:ring-2 focus-visible:ring-signal-info/15",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});
Select.displayName = "Select";
