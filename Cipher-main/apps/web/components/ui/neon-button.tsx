import * as React from "react";
import { Slot, Slottable } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative group inline-flex items-center justify-center gap-2 whitespace-nowrap border text-foreground text-center rounded-full font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-info/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-base disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-signal-info/5 hover:bg-signal-info/10 border-signal-info/20 hover:border-signal-info/50 hover:text-ink-primary",
        solid: "border-signal-info bg-signal-info text-ink-primary hover:bg-signal-info/90",
        outline: "bg-slate-base/40 border-slate-strong hover:border-signal-info/60 hover:bg-signal-info/10 hover:text-ink-primary",
        ghost: "border-transparent hover:bg-slate-elevated/70 text-ink-secondary hover:text-ink-primary"
      },
      size: {
        default: "h-10 px-4 py-2 text-sm",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  neon?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, neon = true, size, variant, asChild = false, children, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props}>
      <Slottable>{children}</Slottable>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-200 group-hover:opacity-100",
          "bg-[radial-gradient(circle_at_50%_0%,rgba(47,129,247,0.18),transparent_55%)]",
          neon && "block"
        )}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -inset-px -z-10 rounded-full opacity-0 blur-md transition-opacity duration-200 group-hover:opacity-100",
          "bg-[rgba(47,129,247,0.16)]",
          neon && "block"
        )}
      />
    </Comp>
  );
});
Button.displayName = "Button";

export { Button, buttonVariants };
