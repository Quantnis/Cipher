import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative group inline-flex items-center justify-center gap-2 whitespace-nowrap border text-foreground text-center rounded-full font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-blue-500/5 hover:bg-blue-500/0 border-blue-500/20 hover:border-blue-400/50 hover:text-cyan-100",
        solid: "bg-blue-500 hover:bg-blue-600 text-white border-transparent hover:border-foreground/50 shadow-[0_0_24px_rgba(59,130,246,0.22)]",
        ghost: "border-transparent bg-transparent hover:border-zinc-600 hover:bg-white/10",
        outline: "bg-slate-950/40 border-slate-700/80 hover:border-cyan-400/60 hover:bg-cyan-500/10 hover:text-cyan-100",
        destructive: "bg-rose-600/15 border-rose-500/35 text-rose-100 hover:bg-rose-600/25 hover:border-rose-400/70 shadow-[0_0_24px_rgba(225,29,72,0.16)]"
      },
      size: {
        default: "h-9 px-7 py-1.5 text-sm",
        sm: "h-8 px-4 py-0.5 text-xs",
        lg: "h-11 px-10 py-2.5 text-base",
        icon: "size-9 p-0"
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
  const classes = cn(buttonVariants({ variant, size }), className);

  if (asChild) {
    return (
      <Slot className={classes} ref={ref} {...props}>
        {children}
      </Slot>
    );
  }

  return (
    <button className={classes} ref={ref} {...props}>
      <span
        className={cn(
          "absolute inset-x-0 inset-y-0 mx-auto hidden h-px w-3/4 bg-gradient-to-r from-transparent via-blue-600 to-transparent opacity-0 transition-all duration-500 ease-in-out group-hover:opacity-100 dark:via-blue-500",
          neon && "block"
        )}
      />
      {children}
      <span
        className={cn(
          "absolute inset-x-0 -bottom-px mx-auto hidden h-px w-3/4 bg-gradient-to-r from-transparent via-blue-600 to-transparent opacity-0 transition-all duration-500 ease-in-out group-hover:opacity-30 dark:via-blue-500",
          neon && "block"
        )}
      />
    </button>
  );
});

Button.displayName = "Button";

export { Button, buttonVariants };
