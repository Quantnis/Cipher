import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-md border border-slate-border bg-slate-base/30 px-3 py-2 font-mono text-sm text-ink-primary outline-none transition-colors placeholder:text-ink-muted focus-visible:border-signal-info/70 focus-visible:ring-2 focus-visible:ring-signal-info/15",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";
