import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      "h-10 w-full rounded-md border border-zinc-800/80 bg-black/30 px-3 font-mono text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus-visible:border-cyan-400/70 focus-visible:ring-2 focus-visible:ring-cyan-400/15",
      className
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";
